import { NextRequest, NextResponse } from 'next/server';
import { createGateway, generateObject } from 'ai';
import { z } from 'zod';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

const BrandColorSchema = z.object({
  hex: z.string().describe('Hex color like #1F2937'),
  label: z.string().describe('Role label like Primary, Accent, Background'),
});

const GeneratedBrandGuideSchema = z.object({
  minimalGuide: z.object({
    status: z.string(),
    styleKeywords: z.array(z.string()),
    toneKeywords: z.array(z.string()),
    logoVariants: z.array(z.string()),
    typography: z.object({
      headingFont: z.string().optional().default(''),
      bodyFont: z.string().optional().default(''),
      displayFont: z.string().optional().default(''),
      logoFont: z.string().optional().default(''),
      h1Font: z.string().optional().default(''),
      h2Font: z.string().optional().default(''),
      h3Font: z.string().optional().default(''),
      paragraphFont: z.string().optional().default(''),
    }),
    colors: z.object({
      primary: z.array(BrandColorSchema).default([]),
      secondary: z.array(BrandColorSchema).default([]),
      neutrals: z.array(BrandColorSchema).default([]),
      text: z.array(BrandColorSchema).default([]),
      backgrounds: z.array(BrandColorSchema).default([]),
      cta: BrandColorSchema.nullable().default(null),
    }),
    updatedAt: z.string(),
  }),
  guideData: z.object({
    recommendedStyleDirection: z.string(),
    toneSummary: z.string(),
    logoGuidance: z.object({
      recommendedVariants: z.array(z.string()).default([]),
      notes: z.array(z.string()).default([]),
    }),
    typography: z.object({
      headingFont: z.string().optional().default(''),
      bodyFont: z.string().optional().default(''),
      displayFont: z.string().optional().default(''),
      pairingNotes: z.array(z.string()).default([]),
    }),
    colors: z.object({
      primary: z.array(BrandColorSchema).default([]),
      secondary: z.array(BrandColorSchema).default([]),
      neutrals: z.array(BrandColorSchema).default([]),
      text: z.array(BrandColorSchema).default([]),
      backgrounds: z.array(BrandColorSchema).default([]),
      cta: BrandColorSchema.nullable().default(null),
    }),
    usageNotes: z.array(z.string()).default([]),
    sourceHighlights: z.array(z.string()).default([]),
  }),
});

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ error: 'AI Gateway not configured' }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const any = supabase as any;
  const userId = session.user.id;

  const [{ data: business }, { data: brandAssets }, { data: existingBrandGuide }, { data: customerInputs }] = await Promise.all([
    any.from('aa_demo_businesses').select('*').eq('user_id', userId).single(),
    any.from('aa_demo_brand_assets').select('*').eq('user_id', userId).single(),
    any.from('brand_guides').select('*').eq('user_id', userId).eq('source', 'onboarding').single(),
    any.from('aa_demo_customer_inputs').select('*').eq('user_id', userId).eq('onboarding_step', 5).eq('is_archived', false).order('created_at', { ascending: true }),
  ]);

  const templateKey = brandAssets?.brand_guide_prompt_template_key || existingBrandGuide?.prompt_template_key || 'brand-guide-default';
  const { data: promptTemplate } = await any
    .from('brand_prompt_templates')
    .select('key, version, prompt_text')
    .eq('key', templateKey)
    .eq('is_active', true)
    .single();
  const uploadedAssetsSource = Array.isArray(brandAssets?.uploaded_assets) && brandAssets.uploaded_assets.length > 0
    ? brandAssets.uploaded_assets
    : customerInputs || [];

  const promptContext = {
    business: {
      name: business?.business_name || '',
      industry: business?.industry || '',
      description: business?.description || '',
      city: business?.location_city || '',
      state: business?.location_state || '',
      website: brandAssets?.existing_website_url || '',
    },
    step4: {
      stylePreference: brandAssets?.style_preference || '',
      toneOfVoice: brandAssets?.tone_of_voice || '',
      brandColors: brandAssets?.brand_colors || [],
      brandFonts: brandAssets?.brand_fonts || [],
      inspirationUrls: brandAssets?.inspiration_urls || [],
      inspirationNotes: brandAssets?.inspiration_notes || '',
      currentSelections: brandAssets?.brand_guide_selections || {},
    },
    step5: {
      websiteInspirationUrls: brandAssets?.website_inspiration_urls || [],
      intakeNotes: brandAssets?.intake_notes || '',
      existingWebsiteScanEnabled: Boolean(brandAssets?.existing_website_url),
      uploadedAssets: uploadedAssetsSource.map((asset: any) => ({
        title: asset.title || asset.file_name || '',
        notes: asset.notes || '',
        tags: asset.tags || asset.asset_tags || [],
        sourceUrl: asset.sourceUrl || asset.source_url || '',
        storageUrl: asset.storageUrl || asset.storage_url || '',
        fileName: asset.fileName || asset.file_name || '',
        mimeType: asset.mimeType || asset.mime_type || '',
        metadata: asset.metadata || {},
      })),
    },
  };

  const renderedPrompt = `${promptTemplate?.prompt_text || 'You are building a client brand guide from structured onboarding inputs.'}

Return a structured brand guide draft that is practical for a website design system. Prefer specific, usable recommendations over vague descriptors. Use only the evidence provided. If evidence is thin, make conservative suggestions and note them as draft-level recommendations.

Context:
${JSON.stringify(promptContext, null, 2)}`;

  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const model = gateway('openai/gpt-4o-mini');

  const { object } = await generateObject({
    model,
    schema: GeneratedBrandGuideSchema,
    prompt: renderedPrompt,
  });

  const now = new Date().toISOString();
  const minimalGuide = {
    ...object.minimalGuide,
    updatedAt: now,
    status: 'needs_review',
  };

  const brandGuidePayload = {
    user_id: userId,
    business_id: business?.id ?? brandAssets?.business_id ?? null,
    customer_id: userId,
    source: 'onboarding',
    status: 'needs_review',
    minimal_guide: minimalGuide,
    guide_data: object.guideData,
    selected_config: brandAssets?.brand_guide_selections || existingBrandGuide?.selected_config || {},
    prompt_template_key: templateKey,
    prompt_context: promptContext,
    extraction_model: 'openai/gpt-4o-mini',
    updated_at: now,
    extracted_at: now,
  };

  const { data: savedBrandGuide, error: brandGuideError } = existingBrandGuide?.id
    ? await any.from('brand_guides').update(brandGuidePayload).eq('id', existingBrandGuide.id).select('*').single()
    : await any.from('brand_guides').insert(brandGuidePayload).select('*').single();

  if (brandGuideError || !savedBrandGuide) {
    console.error('[onboarding/generate-brand-guide] brand guide save error:', brandGuideError);
    return NextResponse.json({ error: brandGuideError?.message || 'Failed to save brand guide' }, { status: 500 });
  }

  const brandAssetsPayload = {
    user_id: userId,
    business_id: business?.id ?? brandAssets?.business_id ?? null,
    brand_guide_status: 'needs_review',
    brand_guide_id: savedBrandGuide.id,
    minimal_brand_guide: minimalGuide,
    brand_guide_prompt_template_key: templateKey,
    updated_at: now,
  };

  const { error: brandAssetsError } = await any.from('aa_demo_brand_assets').upsert(brandAssetsPayload, { onConflict: 'user_id' });
  if (brandAssetsError) {
    console.error('[onboarding/generate-brand-guide] brand_assets mirror error:', brandAssetsError);
    return NextResponse.json({ error: brandAssetsError.message }, { status: 500 });
  }

  const adminAny = supabaseAdminClient as any;
  const { error: snapshotError } = await adminAny.from('brand_prompt_snapshots').insert({
    brand_guide_id: savedBrandGuide.id,
    user_id: userId,
    business_id: business?.id ?? brandAssets?.business_id ?? null,
    template_key: templateKey,
    template_version: promptTemplate?.version ?? 1,
    prompt_text: renderedPrompt,
    prompt_context: promptContext,
    model: 'openai/gpt-4o-mini',
  });

  if (snapshotError) {
    console.error('[onboarding/generate-brand-guide] prompt snapshot error:', snapshotError);
  }

  return NextResponse.json({
    brandGuide: savedBrandGuide,
    minimalBrandGuide: minimalGuide,
    brandGuideStatus: 'needs_review',
    brandGuideId: savedBrandGuide.id,
    brandGuidePromptTemplateKey: templateKey,
    brandGuideSelections: savedBrandGuide.selected_config || {},
  });
}
