import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

/**
 * GET /api/onboarding/load
 * Loads existing business, brand assets, onboarding brand guide,
 * and unified customer inputs data for the current user
 * to pre-fill onboarding forms.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch business data
  const { data: business } = await supabase
    .from('aa_demo_businesses')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Fetch brand assets
  const { data: brandAssets } = await supabase
    .from('aa_demo_brand_assets')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const { data: brandGuide } = await supabase
    .from('brand_guides')
    .select('*')
    .eq('user_id', user.id)
    .eq('source', 'onboarding')
    .single();

  const { data: customerInputs } = await supabase
    .from('aa_demo_customer_inputs')
    .select('*')
    .eq('user_id', user.id)
    .eq('onboarding_step', 5)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    business: business || null,
    brandAssets: brandAssets || null,
    brandGuide: brandGuide || null,
    customerInputs: customerInputs || [],
  });
}
