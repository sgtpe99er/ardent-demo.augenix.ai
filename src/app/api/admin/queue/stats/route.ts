import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

// GET /api/admin/queue/stats
// Returns summary counts for the queue header badges.
// Polled every 15s from the admin queue page.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: user.id } as any);
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch all non-cancelled counts in one query
  const { data, error } = await supabaseAdminClient
    .from('aa_demo_async_requests')
    .select('status, created_at')
    .neq('status', 'cancelled');

  if (error) {
    console.error('admin/queue/stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const counts = {
    pending: 0,
    claimed: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    completed_today: 0,
  };

  for (const row of data ?? []) {
    const s = (row as any).status as string;
    if (s in counts) {
      (counts as any)[s]++;
    }
    if (s === 'completed' && (row as any).created_at >= todayIso) {
      counts.completed_today++;
    }
  }

  return NextResponse.json(counts);
}
