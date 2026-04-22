import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { uploadToCanvaAndCreateDesign } from '@/libs/canva-connect';

// POST /api/user/generated-assets/[assetId]/edit-in-canva
// Uploads the logo to Canva, creates an editable design, stores canvaDesignId in metadata,
// and returns the Canva edit URL so the client can open it.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const canvaToken = process.env.CANVA_API_TOKEN;
  if (!canvaToken) {
    return NextResponse.json(
      { error: 'CANVA_API_TOKEN not configured. Set it in Vercel env vars.' },
      { status: 501 }
    );
  }

  const { assetId } = await params;

  // Fetch the asset, verify ownership
  const { data: asset, error: fetchError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, user_id, storage_url, metadata, asset_type')
    .eq('id', assetId)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const typedAsset = asset as {
    id: string;
    user_id: string;
    storage_url: string | null;
    metadata: Record<string, unknown> | null;
    asset_type: string;
  };

  if (typedAsset.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // If already has a Canva design, return the existing one
  if (typeof typedAsset.metadata?.canvaDesignId === 'string') {
    const editUrl =
      typeof typedAsset.metadata.canvaEditUrl === 'string'
        ? typedAsset.metadata.canvaEditUrl
        : `https://www.canva.com/design/${typedAsset.metadata.canvaDesignId}/edit`;
    return NextResponse.json({ success: true, editUrl, designId: typedAsset.metadata.canvaDesignId });
  }

  if (!typedAsset.storage_url) {
    return NextResponse.json({ error: 'Asset has no storage URL' }, { status: 400 });
  }

  // Download the image from Supabase Storage
  const imageResponse = await fetch(typedAsset.storage_url);
  if (!imageResponse.ok) {
    return NextResponse.json({ error: 'Failed to fetch logo image' }, { status: 500 });
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  const contentType = imageResponse.headers.get('content-type') || 'image/png';

  // Get business name for design title
  const { data: business } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('business_name')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const businessName = (business as { business_name?: string } | null)?.business_name ?? 'Logo';

  const variant = (typedAsset.metadata?.variant as string) ?? 'logo';
  const ext = contentType.includes('svg') ? 'svg' : contentType.includes('webp') ? 'webp' : 'png';
  const assetName = `${businessName} - ${variant}.${ext}`;
  const designTitle = `${businessName} Logo`;

  try {
    const { assetId: canvaAssetId, designId, editUrl } = await uploadToCanvaAndCreateDesign(
      imageBuffer,
      contentType,
      assetName,
      designTitle,
      canvaToken
    );

    // Store Canva IDs in metadata
    await supabaseAdminClient
      .from('aa_demo_generated_assets')
      .update({
        metadata: {
          ...(typedAsset.metadata ?? {}),
          canvaAssetId,
          canvaDesignId: designId,
          canvaEditUrl: editUrl,
          canva_uploaded_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', assetId);

    return NextResponse.json({ success: true, editUrl, designId });
  } catch (err) {
    console.error('[edit-in-canva] Canva upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Canva upload failed' },
      { status: 500 }
    );
  }
}
