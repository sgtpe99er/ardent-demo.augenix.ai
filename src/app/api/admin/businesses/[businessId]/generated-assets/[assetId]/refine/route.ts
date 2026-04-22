import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';
import sharp from 'sharp';

const RECRAFT_API_BASE = 'https://external.api.recraft.ai/v1';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', {
    user_uuid: session.user.id,
  } as any);
  return isAdmin ? session : null;
}

// POST /api/admin/businesses/[businessId]/generated-assets/[assetId]/refine
// Refines a logo: SVG → PNG → imageToImage (V3) → vectorize → new SVG
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; assetId: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { businessId, assetId } = await params;

  const recraftKey = process.env.RECRAFT_API_KEY;
  if (!recraftKey) {
    return NextResponse.json({ error: 'RECRAFT_API_KEY not configured' }, { status: 500 });
  }

  let body: { notes: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { notes } = body;
  if (!notes?.trim()) {
    return NextResponse.json({ error: 'notes is required' }, { status: 400 });
  }

  const db = supabaseAdminClient;

  // 1. Fetch the original asset
  const { data: asset, error: assetError } = await db
    .from('aa_demo_generated_assets')
    .select('*')
    .eq('id', assetId)
    .eq('business_id', businessId)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const typedAsset = asset as any;
  if (!typedAsset.storage_url) {
    return NextResponse.json({ error: 'Asset has no storage URL' }, { status: 400 });
  }

  // 2. Fetch business info for the prompt
  const { data: business } = await db
    .from('aa_demo_businesses')
    .select('business_name, industry, services_products')
    .eq('id', businessId)
    .single();

  const biz = business as any;

  // 3. Download the current SVG/image
  console.log(`[refine] Downloading original asset: ${typedAsset.storage_url}`);
  const originalRes = await fetch(typedAsset.storage_url);
  if (!originalRes.ok) {
    return NextResponse.json({ error: 'Failed to download original asset' }, { status: 500 });
  }

  const originalBuffer = Buffer.from(await originalRes.arrayBuffer());

  // 4. Convert to PNG for imageToImage (sharp handles SVG, WebP, PNG)
  console.log(`[refine] Converting to PNG for imageToImage...`);
  const pngBuffer = await sharp(originalBuffer)
    .resize(512, 512, { fit: 'inside', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  // 5. Call Recraft V3 imageToImage
  console.log(`[refine] Calling Recraft V3 imageToImage with strength=0.3...`);
  const refinementPrompt = `Refine this logo for ${biz?.business_name ?? 'this business'}${biz?.industry ? `, a ${biz.industry} company` : ''}${biz?.services_products ? ` offering ${biz.services_products}` : ''}. Keep the overall structure and style identical, but apply these precise changes: ${notes}. Remain clean, minimalist, professional, vector-ready.`;

  const i2iForm = new FormData();
  i2iForm.append('image', new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' }), 'logo.png');
  i2iForm.append('prompt', refinementPrompt);
  i2iForm.append('strength', '0.3');
  i2iForm.append('model', 'recraftv3');
  i2iForm.append('n', '1');
  i2iForm.append('response_format', 'url');

  const i2iRes = await fetch(`${RECRAFT_API_BASE}/images/imageToImage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recraftKey}` },
    body: i2iForm,
  });

  if (!i2iRes.ok) {
    const errText = await i2iRes.text();
    console.error(`[refine] imageToImage error: ${i2iRes.status}`, errText);
    return NextResponse.json({ error: `imageToImage failed: ${i2iRes.status}` }, { status: 502 });
  }

  const i2iData = await i2iRes.json();
  const rasterUrl = i2iData?.data?.[0]?.url;
  if (!rasterUrl) {
    console.error('[refine] No raster URL in imageToImage response:', JSON.stringify(i2iData).slice(0, 500));
    return NextResponse.json({ error: 'No image returned from imageToImage' }, { status: 502 });
  }

  // 6. Download the refined raster
  console.log(`[refine] Downloading refined raster...`);
  const rasterRes = await fetch(rasterUrl);
  if (!rasterRes.ok) {
    return NextResponse.json({ error: 'Failed to download refined raster' }, { status: 502 });
  }
  const rasterBuffer = Buffer.from(await rasterRes.arrayBuffer());

  // 7. Call Recraft vectorize to convert back to SVG
  console.log(`[refine] Calling Recraft vectorize...`);
  const vecForm = new FormData();
  vecForm.append('file', new Blob([new Uint8Array(rasterBuffer)], { type: 'image/png' }), 'refined.png');
  vecForm.append('response_format', 'url');

  const vecRes = await fetch(`${RECRAFT_API_BASE}/images/vectorize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recraftKey}` },
    body: vecForm,
  });

  if (!vecRes.ok) {
    const errText = await vecRes.text();
    console.error(`[refine] vectorize error: ${vecRes.status}`, errText);
    return NextResponse.json({ error: `vectorize failed: ${vecRes.status}` }, { status: 502 });
  }

  const vecData = await vecRes.json();
  const svgUrl = vecData?.image?.url;
  if (!svgUrl) {
    console.error('[refine] No SVG URL in vectorize response:', JSON.stringify(vecData).slice(0, 500));
    return NextResponse.json({ error: 'No SVG returned from vectorize' }, { status: 502 });
  }

  // 8. Fetch the SVG string
  const svgRes = await fetch(svgUrl);
  if (!svgRes.ok) {
    return NextResponse.json({ error: 'Failed to download refined SVG' }, { status: 502 });
  }
  const svgString = await svgRes.text();

  if (!svgString.includes('<svg')) {
    console.error('[refine] Vectorize output is not SVG:', svgString.slice(0, 200));
    return NextResponse.json({ error: 'Vectorize did not return valid SVG' }, { status: 502 });
  }

  // 9. Upload new SVG to Supabase Storage
  const currentRound = typedAsset.feedback_round ?? 1;
  const variant = (typedAsset.metadata?.variant as string) ?? 'refined';
  const fileName = `${typedAsset.user_id}/logo/round-${currentRound}-${variant}-refinement-${Date.now()}.svg`;

  const { error: uploadError } = await db.storage
    .from('generated-assets')
    .upload(fileName, Buffer.from(svgString, 'utf-8'), {
      contentType: 'image/svg+xml',
      upsert: true,
    });

  if (uploadError) {
    console.error('[refine] Storage upload error:', uploadError);
    return NextResponse.json({ error: 'Failed to upload refined SVG' }, { status: 500 });
  }

  const { data: { publicUrl } } = db.storage.from('generated-assets').getPublicUrl(fileName);

  // 10. Create new generated_assets record (keep original)
  const { data: newAsset, error: insertError } = await db
    .from('aa_demo_generated_assets')
    .insert({
      user_id: typedAsset.user_id,
      business_id: businessId,
      asset_type: 'logo',
      storage_url: publicUrl,
      status: 'ready',
      feedback_round: currentRound,
      is_selected: false,
      metadata: {
        variant,
        prompt: refinementPrompt,
        ai_model: 'recraft/v3-imageToImage+vectorize',
        generation_type: 'refinement',
        parent_asset_id: assetId,
        refinement_notes: notes,
        file_format: 'svg',
      },
    } as any)
    .select('id, storage_url, metadata')
    .single();

  if (insertError) {
    console.error('[refine] DB insert error:', insertError);
    return NextResponse.json({ error: 'Failed to create refined asset record' }, { status: 500 });
  }

  console.log(`[refine] Refinement complete. New asset: ${(newAsset as any).id}`);

  return NextResponse.json({
    success: true,
    asset: newAsset,
  });
}
