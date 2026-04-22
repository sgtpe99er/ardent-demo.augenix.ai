import { NextRequest } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { requestDescription, targetPage } = body as { requestDescription: string; targetPage?: string | null };

  if (!requestDescription?.trim()) {
    return Response.json({ error: 'requestDescription is required' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const userId = session.user.id;

  // Enforce monthly edit limit
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('aa_demo_edit_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'rejected')
    .gte('created_at', startOfMonth.toISOString());

  const MAX_MONTHLY_EDITS = 5;
  if ((count ?? 0) >= MAX_MONTHLY_EDITS) {
    return Response.json({ error: 'Monthly edit limit reached' }, { status: 429 });
  }

  // Fetch business_id
  const { data: business } = await supabase
    .from('aa_demo_businesses')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle() as unknown as { data: { id: string } | null };

  const { data: inserted, error } = await supabase
    .from('aa_demo_edit_requests')
    .insert({
      user_id: userId,
      business_id: business?.id ?? null,
      request_description: requestDescription.trim(),
      target_page: targetPage ?? null,
      status: 'pending',
    } as unknown as never)
    .select('id')
    .single();

  if (error) {
    console.error('[edit-requests POST]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Also enqueue in async_requests for agent processing
  const { error: queueError } = await supabaseAdminClient
    .from('aa_demo_async_requests')
    .insert({
      business_id: business?.id ?? null,
      user_id: userId,
      task_type: 'edit_request',
      payload: {
        editRequestId: (inserted as unknown as { id: string }).id,
        businessId: business?.id ?? null,
        pageTarget: targetPage ?? null,
        editDescription: requestDescription.trim(),
      },
    } as never);

  if (queueError) {
    console.error('[edit-requests POST] async_requests insert failed:', queueError);
    // Non-fatal — edit_request record exists; agent can still be triggered manually
  }

  return Response.json({ ok: true }, { status: 201 });
}
