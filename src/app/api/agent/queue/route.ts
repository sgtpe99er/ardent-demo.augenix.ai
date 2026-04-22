import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

function verifyAgentApiKey(request: NextRequest): boolean {
  const key = process.env.FREEWEBSITE_AGENT_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

// GET /api/agent/queue?task_type=logo_generation,logo_refresh&status=pending&limit=5
// Agents poll this on each heartbeat to discover pending work.
export async function GET(request: NextRequest) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskTypeParam = searchParams.get('task_type');
  const statusParam = searchParams.get('status') ?? 'pending';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 50);

  let query = supabaseAdminClient
    .from('aa_demo_async_requests')
    .select('id, business_id, user_id, task_type, priority, payload, status, claimed_by, claimed_at, retry_count, max_retries, created_at, updated_at')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit);

  // Filter by status (comma-separated supported)
  const statuses = statusParam.split(',').map((s) => s.trim());
  if (statuses.length === 1) {
    query = query.eq('status', statuses[0]);
  } else {
    query = query.in('status', statuses);
  }

  // Filter by task_type (comma-separated supported)
  if (taskTypeParam) {
    const types = taskTypeParam.split(',').map((t) => t.trim());
    if (types.length === 1) {
      query = query.eq('task_type', types[0]);
    } else {
      query = query.in('task_type', types);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('agent/queue GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
