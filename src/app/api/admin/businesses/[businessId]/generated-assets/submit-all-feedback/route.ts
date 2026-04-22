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

interface FeedbackEntry {
  assetId: string;
  overallRating?: string;
  categoryRatings?: Record<string, string>;
  notes?: string;
}

// POST /api/admin/businesses/[businessId]/generated-assets/submit-all-feedback
// Batch submit feedback for all logos in the current round
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { businessId } = await params;

  let body: { feedbacks: FeedbackEntry[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { feedbacks } = body;
  if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
    return NextResponse.json({ error: 'feedbacks array is required' }, { status: 400 });
  }

  // Fetch feedback_round + metadata for each asset
  const assetIds = feedbacks.map((f) => f.assetId);
  const { data: assets, error: assetsError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, feedback_round, metadata')
    .in('id', assetIds);

  if (assetsError) {
    console.error('[Submit All Feedback] Asset fetch error:', assetsError);
    return NextResponse.json({ error: assetsError.message }, { status: 500 });
  }

  type AssetRow = { id: string; feedback_round: number; metadata: Record<string, any> | null };
  const assetRows = (assets ?? []) as unknown as AssetRow[];
  const roundByAssetId = new Map<string, number>(assetRows.map((a) => [a.id, a.feedback_round ?? 1]));
  const assetMap = new Map<string, AssetRow>(assetRows.map((a) => [a.id, a]));

  const records = feedbacks.map((f) => ({
    asset_id: f.assetId,
    business_id: businessId,
    overall_rating: f.overallRating ?? null,
    category_ratings: f.categoryRatings ?? {},
    notes: f.notes ?? '',
    feedback_round: roundByAssetId.get(f.assetId) ?? 1,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdminClient
    .from('logo_feedback' as any)
    .insert(records);

  if (error) {
    console.error('[Submit All Feedback] Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Remove (reject) logos where overall rating is 'dislike'
  const dislikedAssetIds = feedbacks
    .filter((f) => f.overallRating === 'dislike')
    .map((f) => f.assetId);

  if (dislikedAssetIds.length > 0) {
    const { error: rejectError } = await supabaseAdminClient
      .from('aa_demo_generated_assets')
      .update({ status: 'rejected' })
      .in('id', dislikedAssetIds);

    if (rejectError) {
      console.error('[Submit All Feedback] Reject error:', rejectError);
    }
  }

  // Determine the next feedback round
  const currentRound = Math.max(...Array.from(roundByAssetId.values()), 1);
  const nextRound = currentRound + 1;

  // Get the user_id for this business
  const { data: business } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('user_id')
    .eq('id', businessId)
    .single();

  if (business) {
    const userId = (business as { user_id: string }).user_id;

    // Categorize feedback into: liked-with-notes, disliked
    const likedWithNotes = feedbacks.filter(
      (f) => f.overallRating === 'like' && f.notes && f.notes.trim().length > 0
    );
    const dislikedFeedbacks = feedbacks.filter((f) => f.overallRating === 'dislike');

    // Build per-logo modification context from liked logos with notes
    const modifications = likedWithNotes.map((f) => {
      const asset = assetMap.get(f.assetId);
      return {
        originalPrompt: (asset?.metadata?.prompt as string) ?? '',
        variant: (asset?.metadata?.variant as string) ?? 'icon_text',
        notes: f.notes!,
      };
    });

    // Build replacement variants from disliked logos
    const replacementVariants = dislikedFeedbacks.map((f) => {
      const asset = assetMap.get(f.assetId);
      return (asset?.metadata?.variant as string) ?? 'icon_text';
    });

    const feedbackSummaries = feedbacks.map((f) => ({
      assetId: f.assetId,
      overallRating: f.overallRating ?? null,
      notes: f.notes ?? '',
    }));

    const totalToGenerate = modifications.length + replacementVariants.length;

    if (totalToGenerate > 0) {
      // Targeted generation: modifications for liked-with-notes, replacements for disliked
      const placeholders = [
        ...modifications.map((m) => ({
          user_id: userId,
          business_id: businessId,
          asset_type: 'logo',
          status: 'generating',
          feedback_round: nextRound,
          metadata: { variant: m.variant, generation_round: nextRound, generation_type: 'modification' },
        })),
        ...replacementVariants.map((variant) => ({
          user_id: userId,
          business_id: businessId,
          asset_type: 'logo',
          status: 'generating',
          feedback_round: nextRound,
          metadata: { variant, generation_round: nextRound, generation_type: 'replacement' },
        })),
      ];

      await supabaseAdminClient.from('aa_demo_generated_assets').insert(placeholders as any);

      triggerLogoGeneration(businessId, {
        feedbackRound: currentRound,
        nextRound,
        previous_feedback: feedbackSummaries,
        modifications,
        replacementVariants,
      });
    } else {
      // No actionable feedback — generate 3 fresh logos
      const variants = ['icon_text', 'wordmark', 'stylistic'];
      const placeholders = variants.map((variant) => ({
        user_id: userId,
        business_id: businessId,
        asset_type: 'logo',
        status: 'generating',
        feedback_round: nextRound,
        metadata: { variant, generation_round: nextRound, generation_type: 'initial' },
      }));

      await supabaseAdminClient.from('aa_demo_generated_assets').insert(placeholders as any);

      triggerLogoGeneration(businessId, {
        feedbackRound: currentRound,
        nextRound,
        previous_feedback: feedbackSummaries,
      });
    }
  }

  return NextResponse.json({ success: true, count: records.length, nextRound });
}
