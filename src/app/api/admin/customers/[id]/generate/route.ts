import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';
import { generateAssets } from '@/libs/ai/asset-generator';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: isAdmin } = await supabase.rpc('is_admin', {
    user_uuid: session.user.id,
  } as any);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: userId } = await params;

  // Use admin client for writes to bypass RLS
  const db = supabaseAdminClient;

  // Fetch the business + brand_assets required for generation input
  const { data: business, error: bizError } = await db
    .from('aa_demo_businesses')
    .select('id, business_name, industry, target_audience, services_products')
    .eq('user_id', userId)
    .single();

  if (bizError || !business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const { data: brandAssets } = await db
    .from('aa_demo_brand_assets')
    .select('has_existing_logo, existing_logo_url, has_brand_colors, brand_colors, style_preference, color_preference, existing_website_url')
    .eq('user_id', userId)
    .maybeSingle();

  // Create/reset asset rows to a consistent "generating" state for UI
  const assetTypes = ['logo', 'branding_guide', 'website_mockup', 'color_palette', 'font_selection'] as const;
  for (const assetType of assetTypes) {
    const { data: existing } = await db
      .from('aa_demo_generated_assets')
      .select('id')
      .eq('user_id', userId)
      .eq('asset_type', assetType)
      .maybeSingle();

    if (!existing) {
      await db.from('aa_demo_generated_assets').insert({
        user_id: userId,
        business_id: (business as any).id,
        asset_type: assetType,
        status: 'generating',
      } as any);
    } else {
      await db
        .from('aa_demo_generated_assets')
        .update({ status: 'generating', storage_url: null, updated_at: new Date().toISOString() } as any)
        .eq('id', (existing as any).id);
    }
  }

  await db
    .from('aa_demo_businesses')
    .update({ status: 'assets_generating', updated_at: new Date().toISOString() } as any)
    .eq('user_id', userId);

  try {
    const result = await generateAssets({
      userId,
      businessId: (business as any).id,
      businessName: (business as any).business_name ?? '',
      industry: (business as any).industry ?? '',
      targetAudience: (business as any).target_audience ?? '',
      servicesProducts: (business as any).services_products ?? '',
      stylePreference: (brandAssets as any)?.style_preference ?? 'modern',
      colorPreference: (brandAssets as any)?.color_preference ?? '',
      hasExistingLogo: (brandAssets as any)?.has_existing_logo ?? false,
      existingLogoUrl: (brandAssets as any)?.existing_logo_url ?? undefined,
      hasBrandColors: (brandAssets as any)?.has_brand_colors ?? false,
      brandColors: (brandAssets as any)?.brand_colors ?? undefined,
      existingWebsiteUrl: (brandAssets as any)?.existing_website_url ?? undefined,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Asset generation failed' },
      { status: 500 }
    );
  }
}
