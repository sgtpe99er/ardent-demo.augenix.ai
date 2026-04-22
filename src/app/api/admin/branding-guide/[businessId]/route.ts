import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', {
    user_uuid: session.user.id,
  } as any);
  return isAdmin ? session : null;
}

function normalizeColorRoles(input: unknown, fallbackLabels: string[]) {
  if (Array.isArray(input)) {
    return input
      .map((item, index) => {
        if (typeof item === 'string') {
          return { label: fallbackLabels[index] || `Color ${index + 1}`, value: item };
        }

        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return {
            label: String(record.label || fallbackLabels[index] || `Color ${index + 1}`),
            value: String(record.value || ''),
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  if (input && typeof input === 'object') {
    return Object.entries(input as Record<string, unknown>).map(([label, value]) => ({
      label: label.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
      value: String(value || ''),
    }));
  }

  return [];
}

function normalizeTags(input: unknown) {
  if (!Array.isArray(input)) return [];

  return input
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { businessId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: business, error: businessError } = await supabase
    .from('aa_demo_businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (businessError || !business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const biz = business as Record<string, unknown>;
  const userId = biz.user_id as string;

  const [{ data: brandAssets }, { data: brandGuide }, { data: customerInputs }, { data: inputFolders }] = await Promise.all([
    supabase.from('aa_demo_brand_assets').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('brand_guides').select('*').eq('customer_id', userId).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('customer_inputs' as any).select('*').eq('user_id', userId).eq('input_type', 'file').order('created_at', { ascending: false }),
    supabase.from('customer_input_folders' as any).select('*').eq('user_id', userId).order('name', { ascending: true }),
  ]);

  const assets = (brandAssets || {}) as Record<string, unknown>;
  const guide = (brandGuide || {}) as Record<string, unknown>;
  const guideColors = (guide.colors || {}) as Record<string, unknown>;
  const guideTypography = (guide.typography || {}) as Record<string, unknown>;

  const data = {
    brandingGuideApprovedAt: (biz.branding_guide_approved_at as string | null) || null,
    customerId: userId,
    businessName: (biz.business_name as string) || '',
    hasExistingLogo: Boolean(assets.has_existing_logo),
    logoUrls: Array.isArray(assets.logo_urls)
      ? assets.logo_urls
      : [assets.existing_logo_url].filter(Boolean),
    uploadedImages: ((customerInputs as Record<string, unknown>[] | null) || []).map((input) => {
      const metadata = (input.metadata as Record<string, unknown> | null) || {};
      const extractedBranding = metadata.extractedBranding as { colors?: string[]; fonts?: string[]; extractedAt?: string } | null;
      return {
        id: String(input.id),
        title: (input.title as string | null) || null,
        notes: (input.notes as string) || '',
        tags: normalizeTags(metadata.tags),
        storageUrl: (input.storage_url as string | null) || null,
        fileName: (input.file_name as string | null) || null,
        mimeType: (input.mime_type as string | null) || null,
        createdAt: (input.created_at as string) || '',
        folderId: (input.folder_id as string | null) || null,
        extractedBranding: extractedBranding ? {
          colors: Array.isArray(extractedBranding.colors) ? extractedBranding.colors : [],
          fonts: Array.isArray(extractedBranding.fonts) ? extractedBranding.fonts : [],
          extractedAt: extractedBranding.extractedAt || '',
        } : null,
      };
    }),
    folders: ((inputFolders as Record<string, unknown>[] | null) || []).map((f) => ({
      id: String(f.id),
      name: (f.name as string) || '',
      createdAt: (f.created_at as string) || '',
    })),
    hasBrandColors: Boolean(assets.has_brand_colors),
    brandColors: Array.isArray(assets.brand_colors) ? assets.brand_colors : [],
    colorPreference: (assets.color_preference as string) || '',
    colors: {
      primary: Array.isArray(guideColors.primary) ? guideColors.primary : [],
      secondary: Array.isArray(guideColors.secondary) ? guideColors.secondary : [],
      accent: Array.isArray(guideColors.accent) ? guideColors.accent : [],
      text: normalizeColorRoles(guideColors.text, ['Heading', 'Body', 'Link', 'Link Hover']),
      background: normalizeColorRoles(guideColors.background, ['Canvas', 'Surface']),
      border: typeof guideColors.border === 'string' ? guideColors.border : '',
    },
    hasBrandFonts: Boolean(assets.has_brand_fonts),
    brandFonts: Array.isArray(assets.brand_fonts) ? assets.brand_fonts : [],
    fontPreference: (assets.font_preference as string) || '',
    typography: {
      fontFamily: {
        primary: String((guideTypography.fontFamily as Record<string, unknown> | undefined)?.primary || 'Inter'),
        secondary: String((guideTypography.fontFamily as Record<string, unknown> | undefined)?.secondary || 'System UI'),
      },
      fontSizes: {
        h1: String((guideTypography.fontSizes as Record<string, unknown> | undefined)?.h1 || '2.75rem'),
        h2: String((guideTypography.fontSizes as Record<string, unknown> | undefined)?.h2 || '2rem'),
        h3: String((guideTypography.fontSizes as Record<string, unknown> | undefined)?.h3 || '1.5rem'),
        body: String((guideTypography.fontSizes as Record<string, unknown> | undefined)?.body || '1rem'),
        small: String((guideTypography.fontSizes as Record<string, unknown> | undefined)?.small || '0.875rem'),
      },
      fontWeights: {
        light: Number((guideTypography.fontWeights as Record<string, unknown> | undefined)?.light || 300),
        normal: Number((guideTypography.fontWeights as Record<string, unknown> | undefined)?.normal || 400),
        medium: Number((guideTypography.fontWeights as Record<string, unknown> | undefined)?.medium || 500),
        semibold: Number((guideTypography.fontWeights as Record<string, unknown> | undefined)?.semibold || 600),
        bold: Number((guideTypography.fontWeights as Record<string, unknown> | undefined)?.bold || 700),
      },
      lineHeights: {
        tight: Number((guideTypography.lineHeights as Record<string, unknown> | undefined)?.tight || 1.15),
        normal: Number((guideTypography.lineHeights as Record<string, unknown> | undefined)?.normal || 1.5),
        relaxed: Number((guideTypography.lineHeights as Record<string, unknown> | undefined)?.relaxed || 1.75),
      },
    },
    stylePreference: (assets.style_preference as string) || '',
    toneOfVoice: (assets.tone_of_voice as string) || '',
    inspirationUrls: Array.isArray(assets.inspiration_urls) ? assets.inspiration_urls : [],
    inspirationNotes: (assets.inspiration_notes as string) || '',
    spacing: ((guide.spacing as Record<string, string>) || {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      '2xl': '48px',
    }),
    borderRadius: ((guide.border_radius as Record<string, string>) || {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
    }),
    shadows: ((guide.shadows as Record<string, string>) || {
      sm: '0 1px 2px rgba(0,0,0,0.08)',
      md: '0 8px 24px rgba(0,0,0,0.12)',
      lg: '0 18px 48px rgba(0,0,0,0.18)',
    }),
    uiPatterns: ((guide.ui_patterns as Record<string, unknown>) || {
      buttons: {
        primary: 'Solid brand fill with strong contrast text',
        secondary: 'Subtle outline with brand accent border',
      },
      cards: 'Rounded cards with soft elevation and generous spacing',
      inputs: 'Clean form fields with subtle borders and clear focus state',
    }),
    cssVariables: (guide.css_variables as string) || '',
  };

  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const session = await checkAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { businessId } = await params;
    const supabase = await createSupabaseServerClient();
    const updates = await request.json();

    const { data: business } = await supabase
      .from('aa_demo_businesses')
      .select('user_id')
      .eq('id', businessId)
      .single();

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const userId = (business as { user_id: string }).user_id;
    const businessUpdates: Record<string, unknown> = {};
    const brandAssetUpdates: Record<string, unknown> = {};
    const brandGuideUpdates: Record<string, unknown> = {};

    if ('brandingGuideApprovedAt' in updates) businessUpdates.branding_guide_approved_at = updates.brandingGuideApprovedAt;
    if ('hasExistingLogo' in updates) brandAssetUpdates.has_existing_logo = updates.hasExistingLogo;
    if ('logoUrls' in updates) {
      brandAssetUpdates.logo_urls = updates.logoUrls;
      brandAssetUpdates.existing_logo_url = Array.isArray(updates.logoUrls) && updates.logoUrls.length > 0 ? updates.logoUrls[0] : null;
    }
    if ('hasBrandColors' in updates) brandAssetUpdates.has_brand_colors = updates.hasBrandColors;
    if ('brandColors' in updates) brandAssetUpdates.brand_colors = updates.brandColors;
    if ('colorPreference' in updates) brandAssetUpdates.color_preference = updates.colorPreference;
    if ('hasBrandFonts' in updates) brandAssetUpdates.has_brand_fonts = updates.hasBrandFonts;
    if ('brandFonts' in updates) brandAssetUpdates.brand_fonts = updates.brandFonts;
    if ('fontPreference' in updates) brandAssetUpdates.font_preference = updates.fontPreference;
    if ('stylePreference' in updates) brandAssetUpdates.style_preference = updates.stylePreference;
    if ('toneOfVoice' in updates) brandAssetUpdates.tone_of_voice = updates.toneOfVoice;
    if ('inspirationUrls' in updates) brandAssetUpdates.inspiration_urls = updates.inspirationUrls;
    if ('inspirationNotes' in updates) brandAssetUpdates.inspiration_notes = updates.inspirationNotes;

    if ('spacing' in updates) brandGuideUpdates.spacing = updates.spacing;
    if ('borderRadius' in updates) brandGuideUpdates.border_radius = updates.borderRadius;
    if ('shadows' in updates) brandGuideUpdates.shadows = updates.shadows;

    if (Object.keys(businessUpdates).length > 0) {
      businessUpdates.updated_at = new Date().toISOString();
      const { error } = await supabase.from('aa_demo_businesses').update(businessUpdates as never).eq('id', businessId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (Object.keys(brandAssetUpdates).length > 0) {
      brandAssetUpdates.updated_at = new Date().toISOString();
      const { data: existing } = await supabaseAdminClient.from('aa_demo_brand_assets').select('id').eq('user_id', userId).maybeSingle();
      if (existing) {
        const { error } = await supabaseAdminClient.from('aa_demo_brand_assets').update(brandAssetUpdates as never).eq('user_id', userId);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        const { error } = await supabaseAdminClient.from('aa_demo_brand_assets').insert({ user_id: userId, ...brandAssetUpdates } as never);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    if (Object.keys(brandGuideUpdates).length > 0) {
      brandGuideUpdates.updated_at = new Date().toISOString();
      const { data: existingGuide } = await supabase.from('brand_guides').select('id').eq('customer_id', userId).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (existingGuide) {
        const { error } = await supabase.from('brand_guides').update(brandGuideUpdates as never).eq('id', (existingGuide as { id: string }).id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
