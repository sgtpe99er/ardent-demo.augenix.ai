import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

// PATCH /api/admin/businesses/[businessId]/generated-assets/[assetId]/canva-url
// Called by the local Paperclip agent after creating a Canva design via MCP.
// Stores the Canva URL back in the generated_asset metadata and marks the edit_request as completed.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; assetId: string }> }
) {
  // Auth: verify LOGO_API_SECRET bearer token
  const logoApiSecret = process.env.LOGO_API_SECRET;
  if (!logoApiSecret) {
    return NextResponse.json({ error: 'LOGO_API_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${logoApiSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { businessId, assetId } = await params;

  let body: { canvaEditUrl: string; canvaDesignId: string; canvaAssetId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.canvaEditUrl || !body.canvaDesignId) {
    return NextResponse.json({ error: 'canvaEditUrl and canvaDesignId are required' }, { status: 400 });
  }

  // Fetch current asset to merge metadata
  const { data: asset, error: fetchError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, metadata')
    .eq('id', assetId)
    .eq('business_id', businessId)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const typedAsset = asset as { id: string; metadata: Record<string, unknown> | null };

  // Update asset metadata with Canva fields
  const { error: updateError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .update({
      metadata: {
        ...(typedAsset.metadata ?? {}),
        canvaEditUrl: body.canvaEditUrl,
        canvaDesignId: body.canvaDesignId,
        ...(body.canvaAssetId ? { canvaAssetId: body.canvaAssetId } : {}),
        canva_uploaded_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', assetId);

  if (updateError) {
    console.error('[canva-url] Failed to update asset:', updateError);
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
  }

  // Mark the corresponding edit_request as completed
  const { error: taskError } = await supabaseAdminClient
    .from('aa_demo_edit_requests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('target_page', `canva-design:${assetId}`)
    .in('status', ['pending', 'in_progress']);

  if (taskError) {
    console.error('[canva-url] Failed to mark task completed:', taskError);
    // Non-fatal — the asset was updated successfully
  }

  return NextResponse.json({ success: true });
}
