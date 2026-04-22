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

// POST /api/admin/businesses/[businessId]/generated-assets/[assetId]/feedback
// Submit (upsert) feedback for a single logo asset
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; assetId: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { businessId, assetId } = await params;

  let body: { overallRating?: string; categoryRatings?: Record<string, string>; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { overallRating, categoryRatings, notes } = body;

  // Verify asset belongs to this business
  const { data: asset, error: assetError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, feedback_round')
    .eq('id', assetId)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const feedbackRound = (asset as any).feedback_round ?? 1;

  // Upsert feedback
  const { data: feedback, error } = await supabaseAdminClient
    .from('logo_feedback' as any)
    .upsert({
      asset_id: assetId,
      business_id: businessId,
      overall_rating: overallRating ?? null,
      category_ratings: categoryRatings ?? {},
      notes: notes ?? '',
      feedback_round: feedbackRound,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'asset_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[Logo Feedback] Upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, feedback });
}
