import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { uploadToCanvaAndCreateDesign } from '@/libs/canva-connect';
import sharp from 'sharp';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { assetId } = await params;

  const { data: winnerAsset, error: fetchError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('id, feedback_round, user_id, storage_url, metadata')
    .eq('id', assetId)
    .single();

  if (fetchError || !winnerAsset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  const asset = winnerAsset as unknown as {
    id: string;
    feedback_round: number;
    user_id: string;
    storage_url: string | null;
    metadata: Record<string, unknown> | null;
  };
  if (asset.user_id !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const feedbackRound = asset.feedback_round ?? 1;

  // Reject all other logos in this round
  await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .update({ status: 'rejected', is_selected: false, updated_at: new Date().toISOString() } as any)
    .eq('user_id', session.user.id)
    .eq('feedback_round', feedbackRound)
    .neq('id', assetId);

  // Extra metadata to store on the winner
  const extraMetadata: Record<string, unknown> = {};

  // 1. Generate WebP and store it in Supabase Storage for website use
  if (asset.storage_url) {
    try {
      const imageResponse = await fetch(asset.storage_url);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/png';

        let webpBuffer: Buffer;
        if (contentType.includes('svg')) {
          // Convert SVG → PNG → WebP via sharp (sharp can't handle SVG directly in all envs)
          webpBuffer = await sharp(Buffer.from(imageBuffer))
            .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 90 })
            .toBuffer();
        } else {
          webpBuffer = await sharp(Buffer.from(imageBuffer)).webp({ quality: 90 }).toBuffer();
        }

        const webpFileName = `${session.user.id}/logo/winner-webp-${Date.now()}.webp`;
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
      console.error('[select-winner] WebP generation error:', err);
    }

    // 2. Upload to Canva for editing (if CANVA_API_TOKEN is configured)
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
            .eq('user_id', session.user.id)
            .maybeSingle();
          const businessName = (business as { business_name?: string } | null)?.business_name ?? 'Logo';
          const variant = (asset.metadata?.variant as string) ?? 'logo';
          const ext2 = contentType2.includes('svg') ? 'svg' : 'png';

          const { assetId: canvaAssetId, designId, editUrl } = await uploadToCanvaAndCreateDesign(
            imageBuffer2,
            contentType2,
            `${businessName} - ${variant}.${ext2}`,
            `${businessName} Logo`,
            canvaToken
          );

          extraMetadata.canvaAssetId = canvaAssetId;
          extraMetadata.canvaDesignId = designId;
          extraMetadata.canvaEditUrl = editUrl;
          extraMetadata.canva_uploaded_at = new Date().toISOString();
        }
      } catch (err) {
        console.error('[select-winner] Canva upload error:', err);
        // Non-fatal — continue without Canva
      }
    }
  }

  // 3. Mark as selected winner with extra metadata
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

  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
  return NextResponse.json({ success: true, winner });
}
