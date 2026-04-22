import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

function verifyAgentApiKey(request: NextRequest): boolean {
  const key = process.env.FREEWEBSITE_AGENT_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

/** Extract the storage path from a Supabase public URL for the generated-assets bucket */
function extractStoragePath(publicUrl: string): string | null {
  const marker = '/storage/v1/object/public/generated-assets/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

// PATCH /api/agent/businesses/[businessId]/generated-assets/[assetId]
// Used by the Logo Designer agent to upload a refreshed image file and update the asset record.
// Accepts multipart/form-data with:
//   file      — the new PNG image
//   metadata  — optional JSON string with extra metadata fields (e.g. canvaDesignId)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; assetId: string }> }
) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assetId } = await params;

  // Fetch existing asset record
  const { data: asset, error: assetError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, user_id, asset_type, storage_url, metadata, status')
    .eq('id', assetId)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const typedAsset = asset as {
    id: string;
    user_id: string;
    asset_type: string;
    storage_url: string | null;
    metadata: Record<string, unknown> | null;
    status: string;
  };

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  // Parse optional extra metadata
  const metadataStr = formData.get('metadata') as string | null;
  let extraMetadata: Record<string, unknown> = {};
  if (metadataStr) {
    try { extraMetadata = JSON.parse(metadataStr); } catch { /* ignore */ }
  }

  // ── 1. Delete old file from Supabase storage ──────────────────────────────

  if (typedAsset.storage_url) {
    const oldPath = extractStoragePath(typedAsset.storage_url);
    if (oldPath) {
      const { error: deleteError } = await supabaseAdminClient.storage
        .from('generated-assets')
        .remove([oldPath]);

      if (deleteError) {
        console.warn('[Agent Asset PATCH] Failed to delete old file:', deleteError.message);
      }
    }
  }

  // ── 2. Upload new file to Supabase storage ────────────────────────────────

  const fileExt = file.name.split('.').pop() || 'png';
  const newFileName = `${typedAsset.user_id}/${typedAsset.asset_type}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabaseAdminClient.storage
    .from('generated-assets')
    .upload(newFileName, file, { contentType: file.type || 'image/png', upsert: false });

  if (uploadError) {
    console.error('[Agent Asset PATCH] Upload error:', uploadError);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdminClient.storage
    .from('generated-assets')
    .getPublicUrl(newFileName);

  // ── 3. Update asset record ────────────────────────────────────────────────

  const { data: updatedAsset, error: updateError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .update({
      storage_url: publicUrl,
      status: 'ready',
      updated_at: new Date().toISOString(),
      metadata: {
        ...(typedAsset.metadata ?? {}),
        ...extraMetadata,
        refreshed_from_canva_at: new Date().toISOString(),
      },
    } as any)
    .eq('id', assetId)
    .select('*')
    .single();

  if (updateError) {
    console.error('[Agent Asset PATCH] DB update error:', updateError);
    return NextResponse.json({ error: 'Failed to update asset record' }, { status: 500 });
  }

  return NextResponse.json({ success: true, url: publicUrl, asset: updatedAsset });
}
