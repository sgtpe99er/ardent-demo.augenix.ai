import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { asset_id } = await req.json();
  if (!asset_id || typeof asset_id !== 'string') {
    return NextResponse.json({ error: 'asset_id is required' }, { status: 400 });
  }

  const db = supabaseAdminClient as any;

  // Verify the asset belongs to this user
  const { data: asset, error: fetchError } = await db
    .from('aa_demo_generated_assets')
    .select('id, asset_type, user_id')
    .eq('id', asset_id)
    .eq('user_id', session.user.id)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  if (asset.asset_type !== 'website_mockup') {
    return NextResponse.json({ error: 'Only website mockups can be selected' }, { status: 400 });
  }

  // Clear any previously selected mockup for this user
  await db
    .from('aa_demo_generated_assets')
    .update({ is_selected: false, updated_at: new Date().toISOString() })
    .eq('user_id', session.user.id)
    .eq('asset_type', 'website_mockup');

  // Mark the chosen mockup as selected
  const { error: updateError } = await db
    .from('aa_demo_generated_assets')
    .update({ is_selected: true, status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', asset_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Update business status to 'approved' so admin knows to start building
  await db
    .from('aa_demo_businesses')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('user_id', session.user.id);

  return NextResponse.json({ success: true });
}
