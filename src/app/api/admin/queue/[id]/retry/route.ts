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

// POST /api/admin/queue/{id}/retry
// Resets a failed (or cancelled) task back to pending so it will be picked up again.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data: item, error: fetchError } = await supabaseAdminClient
    .from('aa_demo_async_requests')
    .select('id, status')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const currentStatus = (item as any).status as string;
  if (!['failed', 'cancelled'].includes(currentStatus)) {
    return NextResponse.json(
      { error: `Only failed or cancelled tasks can be retried. Current status: ${currentStatus}` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdminClient
    .from('aa_demo_async_requests')
    .update({
      status: 'pending',
      claimed_by: null,
      claimed_at: null,
      error: null,
      updated_at: now,
    } as never)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('admin/queue retry error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ item: updated });
}
