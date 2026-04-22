import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

function verifyAgentApiKey(request: NextRequest): boolean {
  const key = process.env.FREEWEBSITE_AGENT_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

async function resolveUserId(businessId: string): Promise<string | null> {
  const { data: business, error } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('user_id')
    .eq('id', businessId)
    .single();

  if (error || !business) return null;
  return (business as { user_id: string }).user_id;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { businessId } = await params;
  const userId = await resolveUserId(businessId);

  if (!userId) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const { data: assets, error } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assets: assets ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { businessId } = await params;
  const userId = await resolveUserId(businessId);

  if (!userId) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const assetType = formData.get('assetType') as string | null;

  if (!file || !assetType) {
    return NextResponse.json({ error: 'Missing file or assetType' }, { status: 400 });
  }

  const fileExt = file.name.split('.').pop() || 'bin';
  const fileName = `${userId}/${assetType}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabaseAdminClient.storage
    .from('generated-assets')
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    console.error('[Agent Generated Assets] Upload error:', uploadError);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdminClient.storage
    .from('generated-assets')
    .getPublicUrl(fileName);

  // Parse optional metadata from form data
  const metadataStr = formData.get('metadata') as string | null;
  let extraMetadata: Record<string, unknown> = {};
  if (metadataStr) {
    try { extraMetadata = JSON.parse(metadataStr); } catch { /* ignore */ }
  }

  const { data: asset, error: insertError } = await supabaseAdminClient
    .from('aa_demo_generated_assets')
    .insert({
      user_id: userId,
      asset_type: assetType,
      storage_url: publicUrl,
      status: 'ready',
      metadata: { uploaded_by_agent: true, ...extraMetadata },
    } as any)
    .select('*')
    .single();

  if (insertError) {
    console.error('[Agent Generated Assets] Insert error:', insertError);
    return NextResponse.json({ error: 'Failed to create asset record' }, { status: 500 });
  }

  // Clean up any 'generating' placeholder assets for this business+type
  if (assetType === 'logo') {
    await supabaseAdminClient
      .from('aa_demo_generated_assets')
      .delete()
      .eq('user_id', userId)
      .eq('asset_type', 'logo')
      .eq('status', 'generating');
  }

  return NextResponse.json({ success: true, url: publicUrl, asset }, { status: 201 });
}
