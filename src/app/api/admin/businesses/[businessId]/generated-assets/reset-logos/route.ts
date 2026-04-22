import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';
import { triggerLogoGeneration } from '@/libs/logo-generation';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', {
    user_uuid: session.user.id,
  } as any);
  return isAdmin ? session : null;
}

// POST /api/admin/businesses/[businessId]/generated-assets/reset-logos
// Deletes all existing logos + feedback, creates 'generating' placeholders,
// then fires the logo-generation Edge Function (Recraft V4).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { businessId } = await params;
  const db = supabaseAdminClient;

  // Get business info
  const { data: business, error: bizError } = await db
    .from('aa_demo_businesses')
    .select('user_id')
    .eq('id', businessId)
    .single();

  if (bizError || !business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const { user_id: userId } = business as any;

  // 1. Cancel any pending/claimed/processing legacy queue items for this business
  await db
    .from('async_requests' as any)
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('business_id', businessId)
    .in('task_type', ['logo_generation', 'logo_refresh'])
    .in('status', ['pending', 'claimed', 'processing']);

  // 2. Get all logo asset IDs so we can delete related feedback
  const { data: logoAssets } = await db
    .from('aa_demo_generated_assets')
    .select('id')
    .eq('business_id', businessId)
    .eq('asset_type', 'logo');

  const logoIds = ((logoAssets ?? []) as any[]).map((a) => a.id);

  // 3. Delete logo feedback for these assets
  if (logoIds.length > 0) {
    await db
      .from('logo_feedback' as any)
      .delete()
      .in('asset_id', logoIds);
  }

  // 4. Delete all logo generated_assets for this business
  await db
    .from('aa_demo_generated_assets')
    .delete()
    .eq('business_id', businessId)
    .eq('asset_type', 'logo');

  // 5. Create 3 'generating' placeholder records so the UI shows a loading state
  const VARIANTS = ['icon_text', 'wordmark', 'stylistic'];
  await db.from('aa_demo_generated_assets').insert(
    VARIANTS.map((variant) => ({
      user_id: userId,
      business_id: businessId,
      asset_type: 'logo',
      status: 'generating',
      feedback_round: 1,
      metadata: { variant, generation_round: 1 },
    })) as any
  );

  // 6. Fire the logo-generation Edge Function (non-blocking)
  triggerLogoGeneration(businessId, { nextRound: 1 });

  return NextResponse.json({ success: true, message: 'Logos reset. Generation started.' });
}
