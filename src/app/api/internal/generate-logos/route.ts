import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
const SLAZZER_API_URL = 'https://api.slazzer.com/v2.0/logo_generator';
const RECRAFT_API_BASE = 'https://external.api.recraft.ai/v1';

type LogoProvider = 'slazzer' | 'recraft' | 'recraft_v4_vector';

const LOGO_VARIANTS = ['icon_text', 'wordmark', 'stylistic'] as const;
type LogoVariant = (typeof LOGO_VARIANTS)[number];

interface Business {
  id: string;
  user_id: string;
  business_name: string;
  industry: string | null;
  location_city: string | null;
  location_state: string | null;
  target_audience: string | null;
  services_products: string | null;
}

interface BrandAssets {
  brand_colors: string[] | null;
  style_preference: string | null;
  color_preference: string | null;
}

interface FeedbackEntry {
  assetId: string;
  overallRating?: string | null;
  notes?: string | null;
}

interface ModificationEntry {
  originalPrompt: string;
  variant: string;
  notes: string;
}

interface FeedbackContext {
  feedbackRound?: number;
  nextRound?: number;
  previous_feedback?: FeedbackEntry[];
  modifications?: ModificationEntry[];
  replacementVariants?: string[];
}

function buildPrompts(biz: Business, ba: BrandAssets | null, feedbackStr: string): string[] {
  const colorHint = ba?.brand_colors?.length
    ? `Use these brand colors: ${ba.brand_colors.join(', ')}.`
    : ba?.color_preference
      ? `Color preference: ${ba.color_preference}.`
      : '';
  const styleHint = ba?.style_preference ? `Style: ${ba.style_preference}.` : '';
  const audienceHint = biz.target_audience ? `Target audience: ${biz.target_audience}.` : '';
  const serviceHint = biz.services_products ? `Business offers: ${biz.services_products}.` : '';
  const industryStr = biz.industry || 'business';

  const base = `"${biz.business_name}", a ${industryStr} company. ${serviceHint} ${audienceHint} ${colorHint} ${styleHint}${feedbackStr}`;

  return [
    `Professional logo for ${base} Icon combined with business name text. Clean, modern vector design. Minimal, scalable, suitable for light and dark backgrounds.`,
    `Elegant wordmark logo for ${base} Typography-only design, no icon. Stylized business name text only. Professional letterforms, readable, memorable.`,
    `Creative brand mark for ${base} Distinctive visual identity with strong personality. Bold, unique style that stands out. Memorable and impactful.`,
  ];
}

function buildDislikedFeedbackString(feedbackContext: FeedbackContext | null | undefined): string {
  if (!feedbackContext?.previous_feedback?.length) return '';
  const disliked = feedbackContext.previous_feedback
    .filter((f) => f.overallRating === 'dislike' && f.notes)
    .map((f) => f.notes);
  if (!disliked.length) return '';
  return ` Avoid what was disliked: ${disliked.join('; ')}.`;
}

interface GatewayImageResult {
  buffer: Buffer;
  contentType: string;
}

async function generateLogoViaGateway(prompt: string, gatewayKey: string): Promise<GatewayImageResult | null> {
  const response = await fetch(`${AI_GATEWAY_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gatewayKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'recraft/recraft-v4',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[generate-logos] AI Gateway error:', response.status, errText);
    return null;
  }

  const data = await response.json();
  const item = data?.data?.[0];

  // Gateway may return b64_json or url
  if (item?.b64_json) {
    return {
      buffer: Buffer.from(item.b64_json, 'base64'),
      contentType: 'image/webp', // Recraft returns WebP by default
    };
  }

  if (item?.url) {
    // Fallback: download from URL
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) return null;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    return { buffer: buf, contentType: imgRes.headers.get('content-type') || 'image/png' };
  }

  console.error('[generate-logos] No image data in gateway response:', JSON.stringify(data).slice(0, 500));
  return null;
}

interface SlazzerOptions {
  businessName: string;
  businessDescription: string;
  color?: string;
  businessType?: string;
}

async function generateLogoViaSlazzer(
  options: SlazzerOptions,
  apiKey: string
): Promise<GatewayImageResult | null> {
  const formData = new FormData();
  formData.append('business_name', options.businessName);
  formData.append('business_description', options.businessDescription);
  if (options.color) formData.append('color', options.color);
  if (options.businessType) formData.append('business_type', options.businessType);

  const response = await fetch(SLAZZER_API_URL, {
    method: 'POST',
    headers: { 'API-KEY': apiKey },
    body: formData,
  });

  const contentType = response.headers.get('content-type') || '';
  console.log(`[generate-logos] Slazzer response: status=${response.status}, content-type=${contentType}`);

  if (!response.ok) {
    const errText = await response.text();
    console.error('[generate-logos] Slazzer API error:', response.status, errText);
    return null;
  }

  // Slazzer may return JSON error with 200 status
  if (contentType.includes('application/json')) {
    const errText = await response.text();
    console.error('[generate-logos] Slazzer returned JSON (likely error):', errText);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  console.log(`[generate-logos] Slazzer image received: ${buffer.length} bytes, type=${contentType}`);
  if (buffer.length < 100) {
    console.error('[generate-logos] Slazzer returned suspiciously small response:', buffer.toString('utf8').slice(0, 500));
    return null;
  }
  return { buffer, contentType: contentType.includes('image') ? contentType : 'image/png' };
}

interface RecraftV4VectorResult {
  svgString: string;
}

async function generateLogoViaRecraftV4Vector(
  prompt: string,
  apiKey: string
): Promise<RecraftV4VectorResult | { error: string }> {
  try {
    const response = await fetch(`${RECRAFT_API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'recraftv4_vector',
        prompt,
        size: '1024x1024',
        response_format: 'url',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `Recraft API ${response.status}: ${errText.slice(0, 300)}` };
    }

    const data = await response.json();
    const svgUrl = data?.data?.[0]?.url;
    if (!svgUrl) {
      return { error: `No SVG URL in response: ${JSON.stringify(data).slice(0, 300)}` };
    }

    const svgRes = await fetch(svgUrl);
    if (!svgRes.ok) {
      return { error: `Failed to fetch SVG from URL: ${svgRes.status}` };
    }

    const svgString = await svgRes.text();
    if (!svgString.includes('<svg')) {
      return { error: `Content is not SVG: ${svgString.slice(0, 100)}` };
    }

    console.log(`[generate-logos] Recraft V4 Vector SVG received: ${svgString.length} chars`);
    return { svgString };
  } catch (err) {
    return { error: `Exception: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// POST /api/internal/generate-logos
// Generates 3 logo variants and stores them in Supabase Storage.
export async function POST(request: NextRequest) {
  // Auth: verify shared secret (always enforced)
  const logoApiSecret = process.env.LOGO_API_SECRET;
  if (!logoApiSecret) {
    console.error('[generate-logos] LOGO_API_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token !== logoApiSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Determine logo provider
  const provider: LogoProvider = (process.env.LOGO_PROVIDER as LogoProvider) || 'slazzer';
  console.log(`[generate-logos] Provider: "${provider}", RECRAFT_API_KEY present: ${!!process.env.RECRAFT_API_KEY}, key length: ${process.env.RECRAFT_API_KEY?.length ?? 0}`);

  // Provider key checks
  if (provider === 'recraft_v4_vector') {
    if (!process.env.RECRAFT_API_KEY) {
      return NextResponse.json({ error: 'RECRAFT_API_KEY not configured' }, { status: 500 });
    }
  } else if (provider === 'recraft') {
    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json({ error: 'AI_GATEWAY_API_KEY not configured' }, { status: 500 });
    }
  } else if (provider === 'slazzer') {
    if (!process.env.SLAZZER_API_KEY) {
      return NextResponse.json({ error: 'SLAZZER_API_KEY not configured' }, { status: 500 });
    }
  }

  // Parse request
  let body: { businessId?: string; feedbackContext?: FeedbackContext | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { businessId, feedbackContext } = body;
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
  }

  const db = supabaseAdminClient;

  // 1. Fetch business context
  const { data: business, error: bizError } = await db
    .from('aa_demo_businesses')
    .select(
      'id, user_id, business_name, industry, location_city, location_state, target_audience, services_products'
    )
    .eq('id', businessId)
    .single();

  if (bizError || !business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  // 2. Fetch brand assets for color/style hints
  const { data: brandAssets } = await db
    .from('aa_demo_brand_assets')
    .select('brand_colors, style_preference, color_preference')
    .eq('business_id', businessId)
    .maybeSingle();

  const biz = business as unknown as Business;
  const ba = (brandAssets ?? null) as BrandAssets | null;
  const nextRound = feedbackContext?.nextRound ?? 1;

  // 3. Build generation task list
  interface GenerationTask {
    prompt: string;
    variant: string;
    type: 'initial' | 'modification' | 'replacement';
  }

  const tasks: GenerationTask[] = [];
  const hasModifications = feedbackContext?.modifications?.length;
  const hasReplacements = feedbackContext?.replacementVariants?.length;

  if (hasModifications || hasReplacements) {
    // Per-logo feedback mode: targeted modifications + replacements
    const dislikedFeedbackStr = buildDislikedFeedbackString(feedbackContext);
    const standardPrompts = buildPrompts(biz, ba, dislikedFeedbackStr);

    // Modification tasks: original prompt + user's change notes
    for (const mod of feedbackContext!.modifications ?? []) {
      const basePrompt = mod.originalPrompt || standardPrompts[
        LOGO_VARIANTS.indexOf(mod.variant as LogoVariant) >= 0
          ? LOGO_VARIANTS.indexOf(mod.variant as LogoVariant)
          : 0
      ];
      tasks.push({
        prompt: `${basePrompt} Modify this design with the following changes: ${mod.notes}`,
        variant: mod.variant,
        type: 'modification',
      });
    }

    // Replacement tasks: fresh variant prompts for disliked logos
    for (const variant of feedbackContext!.replacementVariants ?? []) {
      const variantIndex = LOGO_VARIANTS.indexOf(variant as LogoVariant);
      tasks.push({
        prompt: standardPrompts[variantIndex >= 0 ? variantIndex : 0],
        variant,
        type: 'replacement',
      });
    }
  } else {
    // Initial generation: 3 standard variant prompts
    const prompts = buildPrompts(biz, ba, '');
    for (let i = 0; i < prompts.length; i++) {
      tasks.push({ prompt: prompts[i], variant: LOGO_VARIANTS[i], type: 'initial' });
    }
  }

  // 4. Generate logos + upload to storage
  const results: { id: string; url: string; variant: string }[] = [];
  const errors: string[] = [];

  // Build Slazzer description from business context
  const slazzerDescription = [
    biz.industry ? `${biz.industry} company` : 'business',
    biz.services_products ? `offering ${biz.services_products}` : '',
    biz.target_audience ? `targeting ${biz.target_audience}` : '',
    biz.location_city && biz.location_state ? `based in ${biz.location_city}, ${biz.location_state}` : '',
  ].filter(Boolean).join('. ');

  const slazzerColor = ba?.brand_colors?.[0] || ba?.color_preference || undefined;
  const slazzerBusinessType = biz.industry || undefined;

  for (const task of tasks) {
    try {
      console.log(`[generate-logos] Generating ${task.type} ${task.variant} logo via ${provider} (round ${nextRound})...`);

      let imageBuffer: Buffer;
      let contentType: string;
      let ext: string;

      if (provider === 'recraft_v4_vector') {
        const svgResult = await generateLogoViaRecraftV4Vector(task.prompt, process.env.RECRAFT_API_KEY!);
        if ('error' in svgResult) {
          const msg = `${task.type} ${task.variant}: ${svgResult.error}`;
          console.error(`[generate-logos] ${msg}`);
          errors.push(msg);
          continue;
        }
        imageBuffer = Buffer.from(svgResult.svgString, 'utf-8');
        contentType = 'image/svg+xml';
        ext = 'svg';
      } else if (provider === 'slazzer') {
        const imageResult = await generateLogoViaSlazzer(
          {
            businessName: biz.business_name,
            businessDescription: slazzerDescription,
            color: slazzerColor,
            businessType: slazzerBusinessType,
          },
          process.env.SLAZZER_API_KEY!
        );
        if (!imageResult) {
          console.error(`[generate-logos] No image data returned for ${task.type} ${task.variant}`);
          continue;
        }
        imageBuffer = imageResult.buffer;
        contentType = imageResult.contentType;
        ext = contentType.includes('webp') ? 'webp' : 'png';
      } else {
        const imageResult = await generateLogoViaGateway(task.prompt, process.env.AI_GATEWAY_API_KEY!);
        if (!imageResult) {
          console.error(`[generate-logos] No image data returned for ${task.type} ${task.variant}`);
          continue;
        }
        imageBuffer = imageResult.buffer;
        contentType = imageResult.contentType;
        ext = contentType.includes('svg') ? 'svg' : contentType.includes('webp') ? 'webp' : 'png';
      }

      // Upload to Supabase Storage
      const fileName = `${biz.user_id}/logo/round-${nextRound}-${task.variant}-${task.type}-${Date.now()}.${ext}`;
      const { error: uploadError } = await db.storage
        .from('generated-assets')
        .upload(fileName, imageBuffer, { contentType, upsert: true });

      if (uploadError) {
        errors.push(`Upload ${task.variant}: ${uploadError.message}`);
        console.error(`[generate-logos] Storage upload error for ${task.variant}:`, uploadError);
        continue;
      }

      const {
        data: { publicUrl },
      } = db.storage.from('generated-assets').getPublicUrl(fileName);

      // 5. Create generated_assets record
      const { data: asset, error: insertError } = await db
        .from('aa_demo_generated_assets')
        .insert({
          user_id: biz.user_id,
          business_id: businessId,
          asset_type: 'logo',
          storage_url: publicUrl,
          status: 'ready',
          feedback_round: nextRound,
          is_selected: false,
          metadata: {
            variant: task.variant,
            prompt: provider === 'slazzer' ? `Slazzer: ${biz.business_name}` : task.prompt,
            ai_model: provider === 'recraft_v4_vector' ? 'recraft/v4-vector' : provider === 'slazzer' ? 'slazzer/v2' : 'recraft/recraft-v4',
            generation_round: nextRound,
            generation_type: task.type,
            file_format: ext,
          },
        } as any)
        .select('id')
        .single();

      if (insertError) {
        errors.push(`DB insert ${task.variant}: ${insertError.message}`);
        console.error(`[generate-logos] DB insert error for ${task.variant}:`, insertError);
        continue;
      }

      results.push({ id: (asset as { id: string }).id, url: publicUrl, variant: task.variant });
      console.log(`[generate-logos] ${task.type} ${task.variant} logo stored: ${publicUrl}`);
    } catch (err) {
      const msg = `Unexpected error for ${task.type} ${task.variant}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[generate-logos] ${msg}`);
      errors.push(msg);
    }
  }

  // 6. Clean up any 'generating' placeholder records for this business
  const { error: cleanupError } = await db
    .from('aa_demo_generated_assets')
    .delete()
    .eq('business_id', businessId)
    .eq('asset_type', 'logo')
    .eq('status', 'generating');

  if (cleanupError) {
    console.error('[generate-logos] Cleanup error:', cleanupError);
  }

  console.log(
    `[generate-logos] Done. Generated ${results.length}/${tasks.length} logos for business ${businessId} via ${provider}`
  );
  if (results.length === 0) {
    console.error(`[generate-logos] WARNING: No logos were generated! Provider=${provider}, tasks=${tasks.length}`);
  }

  return NextResponse.json({
    success: results.length > 0,
    generated: results.length,
    assets: results,
    provider,
    taskCount: tasks.length,
    errors: errors.length > 0 ? errors : undefined,
    debug: { recraftKeyLen: process.env.RECRAFT_API_KEY?.length ?? 0, recraftKeyFirst5: process.env.RECRAFT_API_KEY?.slice(0, 5) ?? 'none' },
  });
}
