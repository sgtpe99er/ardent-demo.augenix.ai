// Logo Generation Edge Function
// Generates 3 logo variants using Recraft V4 via Vercel AI Gateway and stores them in Supabase Storage.
//
// Input:  POST { businessId: string, feedbackContext?: FeedbackContext }
// Output: { success: boolean, generated: number, assets: { id, url, variant }[] }
//
// Required Supabase secrets:
//   AI_GATEWAY_API_KEY  — Vercel AI Gateway key (set: supabase secrets set AI_GATEWAY_API_KEY=<key>)
//   LOGO_API_SECRET     — Shared secret for caller authentication (set same value in Vercel env)
//
// Deploy:  supabase functions deploy logo-generation --no-verify-jwt
// Secrets: supabase secrets set AI_GATEWAY_API_KEY=<key> LOGO_API_SECRET=<secret>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'

interface Business {
  id: string
  user_id: string
  business_name: string
  industry: string | null
  location_city: string | null
  location_state: string | null
  target_audience: string | null
  services_products: string | null
}

interface BrandAssets {
  brand_colors: string[] | null
  style_preference: string | null
  color_preference: string | null
}

interface FeedbackEntry {
  assetId: string
  overallRating?: string | null
  notes?: string | null
}

interface FeedbackContext {
  feedbackRound?: number
  nextRound?: number
  previous_feedback?: FeedbackEntry[]
}

const LOGO_VARIANTS = ['icon_text', 'wordmark', 'stylistic'] as const
type LogoVariant = (typeof LOGO_VARIANTS)[number]

function buildPrompts(biz: Business, ba: BrandAssets | null, feedbackStr: string): string[] {
  const colorHint = ba?.brand_colors?.length
    ? `Use these brand colors: ${ba.brand_colors.join(', ')}.`
    : ba?.color_preference
    ? `Color preference: ${ba.color_preference}.`
    : ''
  const styleHint = ba?.style_preference ? `Style: ${ba.style_preference}.` : ''
  const audienceHint = biz.target_audience ? `Target audience: ${biz.target_audience}.` : ''
  const serviceHint = biz.services_products ? `Business offers: ${biz.services_products}.` : ''
  const industryStr = biz.industry || 'business'

  const base = `"${biz.business_name}", a ${industryStr} company. ${serviceHint} ${audienceHint} ${colorHint} ${styleHint}${feedbackStr}`

  return [
    // 1. Icon + text logo
    `Professional logo for ${base} Icon combined with business name text. Clean, modern vector design. Minimal, scalable, suitable for light and dark backgrounds.`,
    // 2. Wordmark
    `Elegant wordmark logo for ${base} Typography-only design, no icon. Stylized business name text only. Professional letterforms, readable, memorable.`,
    // 3. Stylistic variation
    `Creative brand mark for ${base} Distinctive visual identity with strong personality. Bold, unique style that stands out. Memorable and impactful.`,
  ]
}

function buildFeedbackString(feedbackContext: FeedbackContext | null | undefined): string {
  if (!feedbackContext?.previous_feedback?.length) return ''
  const liked = feedbackContext.previous_feedback
    .filter((f) => f.overallRating === 'like' && f.notes)
    .map((f) => f.notes)
  const disliked = feedbackContext.previous_feedback
    .filter((f) => f.overallRating === 'dislike' && f.notes)
    .map((f) => f.notes)
  let str = ''
  if (liked.length) str += ` Incorporate what was liked: ${liked.join('; ')}.`
  if (disliked.length) str += ` Avoid what was disliked: ${disliked.join('; ')}.`
  return str
}

async function generateLogoViaGateway(prompt: string, gatewayKey: string): Promise<string | null> {
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
      response_format: 'url',
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[logo-generation] AI Gateway error:', response.status, errText)
    return null
  }

  const data = await response.json()
  return (data?.data?.[0]?.url as string) ?? null
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Auth: verify shared secret
  const logoApiSecret = Deno.env.get('LOGO_API_SECRET')
  if (logoApiSecret) {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (token !== logoApiSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
  }

  // Gateway key check
  const gatewayKey = Deno.env.get('AI_GATEWAY_API_KEY')
  if (!gatewayKey) {
    return new Response(JSON.stringify({ error: 'AI_GATEWAY_API_KEY secret not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // Parse request
  let body: { businessId?: string; feedbackContext?: FeedbackContext }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const { businessId, feedbackContext } = body
  if (!businessId) {
    return new Response(JSON.stringify({ error: 'businessId is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // Supabase admin client (env vars auto-injected by Supabase)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Fetch business context
  const { data: business, error: bizError } = await supabase
    .from('aa_demo_businesses')
    .select('id, user_id, business_name, industry, location_city, location_state, target_audience, services_products')
    .eq('id', businessId)
    .single()

  if (bizError || !business) {
    return new Response(JSON.stringify({ error: 'Business not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // 2. Fetch brand assets for color/style hints
  const { data: brandAssets } = await supabase
    .from('brand_assets')
    .select('brand_colors, style_preference, color_preference')
    .eq('business_id', businessId)
    .maybeSingle()

  const biz = business as unknown as Business
  const ba = (brandAssets ?? null) as BrandAssets | null
  const nextRound = feedbackContext?.nextRound ?? 1

  // 3. Build prompts
  const feedbackStr = buildFeedbackString(feedbackContext)
  const prompts = buildPrompts(biz, ba, feedbackStr)

  // 4. Generate logos + upload to storage
  const results: { id: string; url: string; variant: LogoVariant }[] = []

  for (let i = 0; i < prompts.length; i++) {
    const variant = LOGO_VARIANTS[i]
    try {
      console.log(`[logo-generation] Generating ${variant} logo (round ${nextRound})...`)

      const imageUrl = await generateLogoViaGateway(prompts[i], gatewayKey)
      if (!imageUrl) {
        console.error(`[logo-generation] No URL returned for variant ${variant}`)
        continue
      }

      // Download the image
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        console.error(`[logo-generation] Failed to download image for variant ${variant}`)
        continue
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const contentType = imageResponse.headers.get('content-type') || 'image/png'
      const ext = contentType.includes('svg') ? 'svg' : contentType.includes('webp') ? 'webp' : 'png'

      // Upload to Supabase Storage
      const fileName = `${biz.user_id}/logo/round-${nextRound}-${variant}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('generated-assets')
        .upload(fileName, imageBuffer, { contentType, upsert: true })

      if (uploadError) {
        console.error(`[logo-generation] Storage upload error for ${variant}:`, uploadError)
        continue
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('generated-assets').getPublicUrl(fileName)

      // 5. Create generated_assets record
      const { data: asset, error: insertError } = await supabase
        .from('generated_assets')
        .insert({
          user_id: biz.user_id,
          business_id: businessId,
          asset_type: 'logo',
          storage_url: publicUrl,
          status: 'ready',
          feedback_round: nextRound,
          is_selected: false,
          metadata: {
            variant,
            prompt: prompts[i],
            ai_model: 'recraft/recraft-v4',
            generation_round: nextRound,
            file_format: ext,
          },
        })
        .select('id')
        .single()

      if (insertError) {
        console.error(`[logo-generation] DB insert error for ${variant}:`, insertError)
        continue
      }

      results.push({ id: (asset as { id: string }).id, url: publicUrl, variant })
      console.log(`[logo-generation] ✓ ${variant} logo stored: ${publicUrl}`)
    } catch (err) {
      console.error(`[logo-generation] Unexpected error for variant ${variant}:`, err)
    }
  }

  // 6. Clean up any 'generating' placeholder records for this business
  const { error: cleanupError } = await supabase
    .from('generated_assets')
    .delete()
    .eq('business_id', businessId)
    .eq('asset_type', 'logo')
    .eq('status', 'generating')

  if (cleanupError) {
    console.error('[logo-generation] Cleanup error:', cleanupError)
  }

  console.log(`[logo-generation] Done. Generated ${results.length}/3 logos for business ${businessId}`)

  return new Response(
    JSON.stringify({ success: results.length > 0, generated: results.length, assets: results }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  )
})
