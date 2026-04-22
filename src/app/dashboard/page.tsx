import { redirect } from 'next/navigation';

import { getSession } from '@/features/account/controllers/get-session';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

import { HomeContent } from './_components/home-content';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userEmail = session.user.email ?? '';
  const supabase = await createSupabaseServerClient();

  const { data: batchesRaw } = await supabase
    .from('aa_demo_reconciliation_batches' as never)
    .select(
      'id, vendor_id, period_start, period_end, status, match_rate, summary, finalized_at, nexsyis_sync_id, aa_demo_vendors(vendor_name)'
    )
    .order('created_at', { ascending: false });

  const { data: statementsRaw } = await supabase
    .from('aa_demo_statements' as never)
    .select('vendor_id, statement_period_start, statement_period_end, total_amount');

  const statements = (statementsRaw ?? []) as any[];

  const batches = ((batchesRaw ?? []) as any[]).map((b) => {
    const s = statements.find(
      (x) =>
        x.vendor_id === b.vendor_id &&
        x.statement_period_start <= b.period_end &&
        x.statement_period_end >= b.period_start
    );
    return {
      id: b.id as number,
      vendor_id: b.vendor_id as number,
      period_start: b.period_start as string,
      period_end: b.period_end as string,
      status: b.status as string,
      match_rate: b.match_rate != null ? Number(b.match_rate) : null,
      summary: (b.summary as string) ?? null,
      vendor_name: (b.aa_demo_vendors?.vendor_name as string) ?? 'Unknown vendor',
      finalized_at: (b.finalized_at as string | null) ?? null,
      nexsyis_sync_id: (b.nexsyis_sync_id as string | null) ?? null,
      statement_total: s ? Number(s.total_amount) : null,
    };
  });

  return <HomeContent userEmail={userEmail} batches={batches} />;
}
