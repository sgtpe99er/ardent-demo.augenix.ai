import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

function verifyAgentApiKey(request: NextRequest): boolean {
  const key = process.env.FREEWEBSITE_AGENT_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

// GET /api/agent/logos/pending-regenerations
// Returns businesses that have logo assets with 'generating' status,
// meaning new logos are needed based on submitted feedback.
export async function GET(request: NextRequest) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: generatingAssets, error } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, business_id, feedback_round, metadata, created_at')
    .eq('asset_type', 'logo')
    .eq('status', 'generating');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!generatingAssets || generatingAssets.length === 0) {
    return NextResponse.json({ pending: [] });
  }

  // Group by business_id, include feedback + Canva design IDs for precision edits
  const byBusiness = new Map<string, {
    businessId: string;
    count: number;
    feedbackRound: number;
    requestedAt: string;
    previousFeedback: any[];
    previousCanvaDesignIds: Record<string, string>;
  }>();
  for (const asset of generatingAssets as any[]) {
    const bizId = asset.business_id;
    if (!byBusiness.has(bizId)) {
      byBusiness.set(bizId, {
        businessId: bizId,
        count: 0,
        feedbackRound: asset.metadata?.based_on_feedback_round ?? asset.feedback_round ?? 1,
        requestedAt: asset.created_at,
        previousFeedback: asset.metadata?.previous_feedback ?? [],
        previousCanvaDesignIds: asset.metadata?.previous_canva_design_ids ?? {},
      });
    }
    const entry = byBusiness.get(bizId)!;
    entry.count++;
  }

  return NextResponse.json({ pending: Array.from(byBusiness.values()) });
}
