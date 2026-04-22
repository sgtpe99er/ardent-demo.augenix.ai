import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

async function assertAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: user.id } as any);
  return !!isAdmin;
}

// PATCH /api/admin/queue/{id}
// Admin can: update priority, cancel a task.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { priority, status } = body;

  const allowedStatuses = ['cancelled'];
  if (status !== undefined && !allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status can only be set to: ${allowedStatuses.join(', ')}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (priority !== undefined) {
    updateData.priority = priority;
  }

  if (status !== undefined) {
    updateData.status = status;
  }

  const { data, error } = await supabaseAdminClient
    .from('aa_demo_async_requests')
    .update(updateData as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('admin/queue PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
