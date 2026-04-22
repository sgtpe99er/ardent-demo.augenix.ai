import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { sendEditRequestReceivedEmail } from '@/features/emails/send-edit-request-received';
import { sendEditRequestCompletedEmail } from '@/features/emails/send-edit-request-completed';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;
    const supabase = await createSupabaseServerClient();

    // Check if admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc('is_admin', {
      user_uuid: user.id,
    } as any);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { complexity, status, admin_notes } = body;

    const updateData: Record<string, unknown> = {};
    if (complexity !== undefined) updateData.complexity = complexity;
    if (status !== undefined) updateData.status = status;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
    if (status === 'completed') updateData.completed_at = new Date().toISOString();
    updateData.updated_at = new Date().toISOString();

    // Fetch the full edit request before updating (need user_id + description)
    const { data: editRequest } = await supabase
      .from('aa_demo_edit_requests')
      .select('user_id, request_description, complexity, website_url')
      .eq('id', requestId)
      .single();

    const { error } = await supabase
      .from('aa_demo_edit_requests')
      .update(updateData as unknown as never)
      .eq('id', requestId);

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ error: 'Failed to update edit request' }, { status: 500 });
    }

    // Send email notifications (fire-and-forget)
    if (editRequest) {
      const userId = (editRequest as any).user_id;
      const { data: authUser } = await supabaseAdminClient.auth.admin.getUserById(userId);
      const { data: business } = await supabaseAdminClient
        .from('aa_demo_businesses')
        .select('business_name')
        .eq('user_id', userId)
        .maybeSingle();
      const { data: deployedWebsite } = await supabaseAdminClient
        .from('aa_demo_deployed_websites')
        .select('live_url')
        .eq('user_id', userId)
        .maybeSingle();

      const userEmail = authUser?.user?.email;
      const businessName = (business as any)?.business_name ?? 'there';
      const requestDescription = (editRequest as any).request_description ?? '';
      const websiteUrl = (deployedWebsite as any)?.live_url ?? undefined;

      if (userEmail) {
        if (status === 'in_progress') {
          const complexityLabel = complexity === 'simple' ? 'Simple' : complexity === 'complex' ? 'Complex' : 'Standard';
          const eta = complexity === 'simple' ? '1-2 business days' : '3-5 business days';
          sendEditRequestReceivedEmail({
            userEmail,
            businessName,
            requestDescription,
            complexity: complexityLabel,
            eta,
          }).catch((err) => console.error('sendEditRequestReceivedEmail failed:', err));
        } else if (status === 'completed') {
          sendEditRequestCompletedEmail({
            userEmail,
            businessName,
            requestDescription,
            websiteUrl,
          }).catch((err) => console.error('sendEditRequestCompletedEmail failed:', err));
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Edit request update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
