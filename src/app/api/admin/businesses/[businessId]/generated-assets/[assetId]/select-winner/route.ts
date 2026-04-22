import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';
import { uploadToCanvaAndCreateDesign } from '@/libs/canva-connect';
import sharp from 'sharp';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', {
    user_uuid: session.user.id,
  } as any);
  return isAdmin ? session : null;
}

// POST /api/admin/businesses/[businessId]/generated-assets/[assetId]/select-winner
// Mark one logo as the winner; reject all others in the same round.
// Also generates WebP for website use and optionally uploads to Canva.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; assetId: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { businessId, assetId } = await params;

  // Fetch the winning asset
  const { data: winnerAsset, error: fetchError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, feedback_round, user_id, storage_url, metadata')
    .eq('id', assetId)
    .single();

  if (fetchError || !winnerAsset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const asset = winnerAsset as unknown as {
    id: string;
    feedback_round: number;
    user_id: string;
    storage_url: string | null;
    metadata: Record<string, unknown> | null;
  };
  const feedbackRound = asset.feedback_round ?? 1;

  // Reject all other logos for this business in the same round
  const { error: rejectError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .update({ status: 'rejected', is_selected: false, updated_at: new Date().toISOString() } as any)
    .eq('user_id', asset.user_id)
    .eq('feedback_round', feedbackRound)
    .neq('id', assetId);

  if (rejectError) {
    console.error('[Select Winner] Reject others error:', rejectError);
    return NextResponse.json({ error: rejectError.message }, { status: 500 });
  }

  const extraMetadata: Record<string, unknown> = {};

  if (asset.storage_url) {
    // 1. Generate WebP for website use
    try {
      const imageResponse = await fetch(asset.storage_url);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        const webpBuffer = contentType.includes('svg')
          ? await sharp(Buffer.from(imageBuffer))
              .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
              .webp({ quality: 90 })
              .toBuffer()
          : await sharp(Buffer.from(imageBuffer)).webp({ quality: 90 }).toBuffer();

        const webpFileName = `${asset.user_id}/logo/winner-webp-${Date.now()}.webp`;
        const { error: webpUploadError } = await supabaseAdminClient.storage
          .from('generated-assets')
          .upload(webpFileName, webpBuffer, { contentType: 'image/webp', upsert: true });

        if (!webpUploadError) {
          const { data: { publicUrl: webpUrl } } = supabaseAdminClient.storage
            .from('generated-assets')
            .getPublicUrl(webpFileName);
          extraMetadata.webpUrl = webpUrl;
        }
      }
    } catch (err) {
      console.error('[Select Winner] WebP generation error:', err);
    }

    // 2. Upload to Canva for editing (if configured and not already uploaded)
    const canvaToken = process.env.CANVA_API_TOKEN;
    if (canvaToken && !asset.metadata?.canvaDesignId) {
      try {
        const imageResponse2 = await fetch(asset.storage_url);
        if (imageResponse2.ok) {
          const imageBuffer2 = await imageResponse2.arrayBuffer();
          const contentType2 = imageResponse2.headers.get('content-type') || 'image/png';

          const { data: business } = await supabaseAdminClient
            .from('aa_demo_businesses')
            .select('business_name')
            .eq('id', businessId)
            .maybeSingle();
          const businessName = (business as { business_name?: string } | null)?.business_name ?? 'Logo';
          const variant = (asset.metadata?.variant as string) ?? 'logo';
          const ext = contentType2.includes('svg') ? 'svg' : 'png';

          const { assetId: canvaAssetId, designId, editUrl } = await uploadToCanvaAndCreateDesign(
            imageBuffer2,
            contentType2,
            `${businessName} - ${variant}.${ext}`,
            `${businessName} Logo`,
            canvaToken
          );

          extraMetadata.canvaAssetId = canvaAssetId;
          extraMetadata.canvaDesignId = designId;
          extraMetadata.canvaEditUrl = editUrl;
          extraMetadata.canva_uploaded_at = new Date().toISOString();
        }
      } catch (err) {
        console.error('[Select Winner] Canva upload error:', err);
        // Non-fatal — continue without Canva
      }
    }
  }

  // Mark as selected winner
  const { data: winner, error: selectError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .update({
      is_selected: true,
      status: 'ready',
      updated_at: new Date().toISOString(),
      ...(Object.keys(extraMetadata).length > 0
        ? { metadata: { ...(asset.metadata ?? {}), ...extraMetadata } }
        : {}),
    } as any)
    .eq('id', assetId)
    .select('*')
    .single();

  if (selectError) {
    console.error('[Select Winner] Select winner error:', selectError);
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, winner });
}
