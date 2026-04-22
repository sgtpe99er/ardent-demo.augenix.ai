import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

async function assertAdmin(): Promise<{ userId: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: user.id } as any);
  if (!isAdmin) return null;
  return { userId: user.id };
}

// GET /api/admin/queue?status=pending&task_type=logo_generation&business_id=...&from=...&to=...&page=1&per_page=25
export async function GET(request: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const taskType = searchParams.get('task_type');
  const businessId = searchParams.get('business_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(100, parseInt(searchParams.get('per_page') ?? '25', 10));
  const offset = (page - 1) * perPage;

  let query = supabaseAdminClient
    .from('aa_demo_async_requests')
    .select('id, business_id, user_id, task_type, priority, payload, status, claimed_by, claimed_at, result, error, retry_count, max_retries, created_at, updated_at, completed_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (status) {
    const statuses = status.split(',').map((s) => s.trim());
    if (statuses.length === 1) {
      query = query.eq('status', statuses[0]);
    } else {
      query = query.in('status', statuses);
    }
  }

  if (taskType) {
    const types = taskType.split(',').map((t) => t.trim());
    if (types.length === 1) {
      query = query.eq('task_type', types[0]);
    } else {
      query = query.in('task_type', types);
    }
  }

  if (businessId) {
    query = query.eq('business_id', businessId);
  }

  if (from) {
    query = query.gte('created_at', from);
  }

  if (to) {
    query = query.lte('created_at', to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('admin/queue GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with business names
  const businessIds = [...new Set((data ?? []).map((r: any) => r.business_id).filter(Boolean))];
  let businessNames: Record<string, string> = {};
  if (businessIds.length > 0) {
    const { data: businesses } = await supabaseAdminClient
      .from('aa_demo_businesses')
      .select('id, business_name')
      .in('id', businessIds);
    for (const b of businesses ?? []) {
      businessNames[(b as any).id] = (b as any).business_name;
    }
  }

  const items = (data ?? []).map((r: any) => ({
    ...r,
    business_name: businessNames[r.business_id] ?? null,
  }));

  return NextResponse.json({
    items,
    total: count ?? 0,
    page,
    per_page: perPage,
  });
}
