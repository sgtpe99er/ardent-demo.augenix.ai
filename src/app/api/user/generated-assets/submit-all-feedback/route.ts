import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { triggerLogoGeneration } from '@/libs/logo-generation';

interface FeedbackEntry {
  assetId: string;
  overallRating?: string;
  categoryRatings?: Record<string, string>;
  notes?: string;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { feedbacks: FeedbackEntry[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { feedbacks } = body;
  if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
    return NextResponse.json({ error: 'feedbacks array is required' }, { status: 400 });
  }

  const assetIds = feedbacks.map((f) => f.assetId);
  const { data: assets, error: assetsError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, feedback_round, user_id, metadata')
    .in('id', assetIds);

  if (assetsError) return NextResponse.json({ error: assetsError.message }, { status: 500 });

  // Verify all assets belong to this user
  type AssetRow = { id: string; feedback_round: number; user_id: string; metadata: Record<string, any> | null };
  const userAssets = (assets ?? []) as unknown as AssetRow[];
  if (userAssets.some((a) => a.user_id !== session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const roundByAssetId = new Map(userAssets.map((a) => [a.id, a.feedback_round ?? 1]));
  const assetMap = new Map<string, AssetRow>(userAssets.map((a) => [a.id, a]));

  // Get the user's business for placeholder creation
  const { data: business } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const businessId = (business as { id: string } | null)?.id ?? null;

  const records = feedbacks.map((f) => ({
    asset_id: f.assetId,
    business_id: businessId,
    overall_rating: f.overallRating ?? null,
    category_ratings: f.categoryRatings ?? {},
    notes: f.notes ?? '',
    feedback_round: roundByAssetId.get(f.assetId) ?? 1,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdminClient.from('logo_feedback' as any).insert(records);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dislikedAssetIds = feedbacks.filter((f) => f.overallRating === 'dislike').map((f) => f.assetId);
  if (dislikedAssetIds.length > 0) {
    await supabaseAdminClient.from('aa_demo_generated_assets').update({ status: 'rejected' }).in('id', dislikedAssetIds);
  }

  const currentRound = Math.max(...Array.from(roundByAssetId.values()), 1);
  const nextRound = currentRound + 1;

  if (businessId) {
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
          user_id: session.user.id,
          business_id: businessId,
          asset_type: 'logo',
          status: 'generating',
          feedback_round: nextRound,
          metadata: { variant: m.variant, generation_round: nextRound, generation_type: 'modification' },
        })),
        ...replacementVariants.map((variant) => ({
          user_id: session.user.id,
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
        user_id: session.user.id,
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
