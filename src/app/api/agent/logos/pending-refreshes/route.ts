import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

function verifyAgentApiKey(request: NextRequest): boolean {
  const key = process.env.FREEWEBSITE_AGENT_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

// GET /api/agent/logos/pending-refreshes
// Returns logo assets that have been queued for a Canva refresh (status = 'refreshing').
// The Logo Designer agent polls this endpoint to find work to do.
export async function GET(request: NextRequest) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: assets, error } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, user_id, business_id, asset_type, storage_url, metadata, created_at')
    .eq('asset_type', 'logo')
    .eq('status', 'refreshing');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!assets || assets.length === 0) {
    return NextResponse.json({ pending: [] });
  }

  const pending = (assets as any[]).map((asset) => ({
    assetId: asset.id,
    userId: asset.user_id,
    businessId: asset.business_id,
    canvaDesignId: asset.metadata?.canvaDesignId ?? null,
    currentStorageUrl: asset.storage_url,
    requestedAt: asset.metadata?.refresh_requested_at ?? asset.created_at,
  }));

  return NextResponse.json({ pending });
}
