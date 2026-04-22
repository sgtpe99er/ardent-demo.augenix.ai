import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    
    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin', {
      user_uuid: session.user.id,
    } as any);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch stats in parallel
    const [
      { data: businesses },
      { data: authUsers },
      { data: editRequests },
      { data: pendingQueueItems },
      { data: hostingPayments }
    ] = await Promise.all([
      supabase.from('aa_demo_businesses').select('status'),
      supabaseAdminClient.auth.admin.listUsers(),
      supabase.from('aa_demo_edit_requests').select('status'),
      supabase.from('aa_demo_async_requests').select('status').in('status', ['pending', 'claimed', 'processing']),
      supabase.from('aa_demo_hosting_payments').select('total_amount, created_at, status')
    ]);

    // Calculate stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthlyRevenue = hostingPayments
      ?.filter((p: any) => p.status === 'paid' && p.created_at >= startOfMonth)
      .reduce((sum: number, p: any) => sum + (p.total_amount ?? 0), 0) ?? 0;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const totalAuthUsers = authUsers?.users?.length ?? 0;
    const newUsersThisWeek = authUsers?.users?.filter((u: any) => u.created_at >= oneWeekAgo).length ?? 0;

    const stats = {
      totalUsers: totalAuthUsers,
      activeWebsites: businesses?.filter((b: any) => b.status === 'active').length ?? 0,
      pendingQueue: pendingQueueItems?.length ?? 0,
      pendingEdits: editRequests?.filter((e: any) => e.status === 'pending').length ?? 0,
      monthlyRevenue,
      newUsersThisWeek,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
