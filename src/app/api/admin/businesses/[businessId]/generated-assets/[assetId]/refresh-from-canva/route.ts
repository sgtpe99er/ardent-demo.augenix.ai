import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
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

// POST /api/admin/businesses/[businessId]/generated-assets/[assetId]/refresh-from-canva
// Marks the asset as pending refresh. The Logo Designer agent will pick it up,
// re-export the Canva design, and update the asset record.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; assetId: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { assetId } = await params;

  // Fetch the asset record
  const { data: asset, error: assetError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, metadata, status')
    .eq('id', assetId)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const typedAsset = asset as {
    id: string;
    status: string;
    metadata: Record<string, unknown> | null;
  };

  const canvaDesignId = typedAsset.metadata?.canvaDesignId;
  if (typeof canvaDesignId !== 'string' || !canvaDesignId) {
    return NextResponse.json({ error: 'Asset has no Canva design ID' }, { status: 400 });
  }

  // Mark asset as refreshing so the Logo Designer agent can pick it up
  const { error: updateError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .update({
      status: 'refreshing',
      metadata: {
        ...(typedAsset.metadata ?? {}),
        refresh_requested_at: new Date().toISOString(),
      },
    } as any)
    .eq('id', assetId);

  if (updateError) {
    console.error('[RefreshFromCanva] DB update error:', updateError);
    return NextResponse.json({ error: 'Failed to queue refresh' }, { status: 500 });
  }

  return NextResponse.json({ status: 'refreshing' });
}
