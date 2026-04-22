import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

function verifyAgentApiKey(request: NextRequest): boolean {
  const key = process.env.FREEWEBSITE_AGENT_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

// POST /api/agent/queue/{id}/claim
// Atomically claims a pending task for an agent.
// Returns 409 if the task is already claimed or not in a claimable state.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { agentId } = body;

  if (!agentId) {
    return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
  }

  // Fetch current state first
  const { data: item, error: fetchError } = await supabaseAdminClient
    .from('aa_demo_async_requests')
    .select('id, status, retry_count, max_retries')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if ((item as any).status !== 'pending') {
    return NextResponse.json(
      { error: 'Task is not in pending state', status: (item as any).status },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // Atomic claim: only update if status is still 'pending'
  const { data: updated, error: updateError } = await supabaseAdminClient
    .from('aa_demo_async_requests')
    .update({
      status: 'claimed',
      claimed_by: agentId,
      claimed_at: now,
      updated_at: now,
    } as never)
    .eq('id', id)
    .eq('status', 'pending')  // guard: only succeed if still pending
    .select()
    .single();

  if (updateError || !updated) {
    // Race condition — another agent claimed it first
    return NextResponse.json({ error: 'Task already claimed' }, { status: 409 });
  }

  return NextResponse.json({ item: updated });
}
