import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
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

// POST /api/admin/businesses/[businessId]/generated-assets/[assetId]/edit-in-canva
// If Canva URL already exists, returns it. Otherwise creates an edit_request task
// for the local Paperclip agent to process via Canva MCP.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; assetId: string }> }
) {
  const session = await checkAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { businessId, assetId } = await params;

  // Fetch the asset
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

  // If already has a Canva design, return the existing URL
  if (typeof typedAsset.metadata?.canvaEditUrl === 'string') {
    return NextResponse.json({
      success: true,
      editUrl: typedAsset.metadata.canvaEditUrl,
      designId: typedAsset.metadata.canvaDesignId,
    });
  }

  if (!typedAsset.storage_url) {
    return NextResponse.json({ error: 'Asset has no storage URL' }, { status: 400 });
  }

  // Check if there's already a pending Canva task for this asset
  const { data: existingTask } = await supabaseAdminClient
    .from('aa_demo_edit_requests')
    .select('id, status')
    .eq('target_page', `canva-design:${assetId}`)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle();

  if (existingTask) {
    return NextResponse.json({ success: true, status: 'queued', taskId: existingTask.id });
  }

  // Get business name for the task description
  const { data: business } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('business_name')
    .eq('id', businessId)
    .maybeSingle();
  const businessName = (business as { business_name?: string } | null)?.business_name ?? 'Unknown Business';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://freewebsite.deal';
  const callbackUrl = `${siteUrl}/api/admin/businesses/${businessId}/generated-assets/${assetId}/canva-url`;

  // Create an edit_request task for the Paperclip agent
  const { data: task, error: insertError } = await supabaseAdminClient
    .from('aa_demo_edit_requests')
    .insert({
      user_id: session.user.id,
      business_id: businessId,
      request_description: [
        'CANVA_DESIGN_TASK',
        `asset_id: ${assetId}`,
        `business_id: ${businessId}`,
        `business_name: ${businessName}`,
        `storage_url: ${typedAsset.storage_url}`,
        `callback_url: ${callbackUrl}`,
        `auth_header: Bearer ${process.env.LOGO_API_SECRET || 'MISSING_SECRET'}`,
        '',
        'Instructions:',
        '1. Download the image from storage_url',
        '2. Use Canva MCP to upload the image and create a new design',
        '3. PATCH the callback_url with JSON body: { "canvaEditUrl": "<url>", "canvaDesignId": "<id>" }',
        '   Include Authorization header with the auth_header value',
      ].join('\n'),
      target_page: `canva-design:${assetId}`,
      status: 'pending',
    } as any)
    .select('id')
    .single();

  if (insertError) {
    console.error('[edit-in-canva] Failed to create task:', insertError);
    return NextResponse.json({ error: 'Failed to queue Canva task' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    status: 'queued',
    taskId: (task as { id: string }).id,
  });
}
