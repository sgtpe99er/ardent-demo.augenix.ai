import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { sendEmail } from '@/libs/email/mailer';
import { sendEditRequestCompletedEmail } from '@/features/emails/send-edit-request-completed';

function verifyAgentApiKey(request: NextRequest): boolean {
  const key = process.env.FREEWEBSITE_AGENT_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

// PATCH /api/agent/queue/{id}
// Agent updates the status of a claimed task.
// Supports: status=processing, status=completed (with result), status=failed (with error, auto-retry logic)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, result, error: taskError } = body;

  const allowedStatuses = ['processing', 'completed', 'failed'];
  if (!status || !allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${allowedStatuses.join(', ')}` },
      { status: 400 }
    );
  }

  // Fetch current item for retry logic and notification
  const { data: item, error: fetchError } = await supabaseAdminClient
    .from('aa_demo_async_requests')
    .select('id, status, task_type, user_id, retry_count, max_retries')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (status === 'completed') {
    if (result !== undefined) updateData.result = result;
    updateData.completed_at = now;
  }

  if (status === 'failed') {
    if (taskError !== undefined) updateData.error = taskError;
    const retryCount = ((item as any).retry_count ?? 0) + 1;
    updateData.retry_count = retryCount;

    // Auto-retry: reset to pending if under max_retries
    if (retryCount < ((item as any).max_retries ?? 3)) {
      updateData.status = 'pending';
      updateData.claimed_by = null;
      updateData.claimed_at = null;
    }
  }

  const { data: updated, error: updateError } = await supabaseAdminClient
    .from('aa_demo_async_requests')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('agent/queue PATCH error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Send completion email for logo tasks
  const logoTaskTypes = ['logo_generation', 'logo_refresh', 'branding_guide'];
  if (status === 'completed' && logoTaskTypes.includes((item as any).task_type)) {
    const userId = (item as any).user_id;
    if (userId) {
      try {
        const { data: userData } = await supabaseAdminClient.auth.admin.getUserById(userId);
        const userEmail = userData?.user?.email;
        if (userEmail) {
          await sendEmail({
            from: 'support@freewebsite.deal',
            to: userEmail,
            subject: 'Your logos are ready!',
            html: `<p>Great news — your new logo designs are ready for review. Log in to your dashboard to see them.</p>`,
            text: 'Great news — your new logo designs are ready for review. Log in to your dashboard to see them.',
          });
        }
      } catch (emailErr) {
        console.error('agent/queue PATCH: failed to send completion email', emailErr);
      }
    }
  }

  // Handle edit_request completion: update edit_requests record + send email
  if (status === 'completed' && (item as any).task_type === 'edit_request') {
    const payload = (item as any).payload ?? {};
    const editRequestId = payload.editRequestId;
    const userId = (item as any).user_id;

    // Mark the edit_request as completed
    if (editRequestId) {
      await supabaseAdminClient
        .from('aa_demo_edit_requests')
        .update({ status: 'completed', completed_at: now, updated_at: now } as never)
        .eq('id', editRequestId);
    }

    // Send completion email
    if (userId) {
      try {
        const { data: userData } = await supabaseAdminClient.auth.admin.getUserById(userId);
        const userEmail = userData?.user?.email;
        if (userEmail) {
          const { data: businessData } = await supabaseAdminClient
            .from('aa_demo_businesses')
            .select('name, domain_name')
            .eq('user_id', userId)
            .maybeSingle();
          const { data: deployedData } = await supabaseAdminClient
            .from('aa_demo_deployed_websites')
            .select('subdomain, prod_url, custom_domain')
            .eq('user_id', userId)
            .maybeSingle();
          const websiteUrl =
            (deployedData as any)?.prod_url ??
            ((deployedData as any)?.custom_domain ? `https://${(deployedData as any).custom_domain}` : null) ??
            ((deployedData as any)?.subdomain ? `https://${(deployedData as any).subdomain}` : undefined);
          await sendEditRequestCompletedEmail({
            userEmail,
            businessName: (businessData as any)?.name ?? 'your business',
            requestDescription: payload.editDescription ?? '',
            websiteUrl,
          });
        }
      } catch (emailErr) {
        console.error('agent/queue PATCH: failed to send edit request completion email', emailErr);
      }
    }
  }

  return NextResponse.json({ item: updated });
}
