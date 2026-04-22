import { NextResponse } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { triggerLogoGeneration } from '@/libs/logo-generation';

// POST /api/user/generated-assets/reset-logos
// Deletes all existing logos + feedback for the authenticated user's business,
// creates 'generating' placeholders, then fires the logo-generation Edge Function.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdminClient;
  const userId = session.user.id;

  // Get user's business
  const { data: business, error: bizError } = await db
    .from('aa_demo_businesses')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (bizError || !business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const businessId = (business as { id: string }).id;

  // 1. Cancel any pending legacy queue items
  await db
    .from('async_requests' as any)
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('business_id', businessId)
    .in('task_type', ['logo_generation', 'logo_refresh'])
    .in('status', ['pending', 'claimed', 'processing']);

  // 2. Get existing logo asset IDs for feedback cleanup
  const { data: logoAssets } = await db
    .from('aa_demo_generated_assets')
    .select('id')
    .eq('user_id', userId)
    .eq('asset_type', 'logo');

  const logoIds = ((logoAssets ?? []) as any[]).map((a) => a.id);

  // 3. Delete logo feedback
  if (logoIds.length > 0) {
    await db.from('logo_feedback' as any).delete().in('asset_id', logoIds);
  }

  // 4. Delete all logo generated_assets for this user
  await db.from('aa_demo_generated_assets').delete().eq('user_id', userId).eq('asset_type', 'logo');

  // 5. Create 'generating' placeholder records so the UI shows a loading state
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
