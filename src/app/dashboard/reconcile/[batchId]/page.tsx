import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/features/account/controllers/get-session';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

import { ReconcileClient } from './_components/reconcile-client';

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default async function ReconcileBatchPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { batchId } = await params;
  const id = Number(batchId);
  if (!id || Number.isNaN(id)) notFound();

  const supabase = await createSupabaseServerClient();

  const { data: batch } = await supabase
    .from('aa_demo_reconciliation_batches' as never)
    .select('*, aa_demo_vendors(vendor_name, location_keys)')
    .eq('id', id)
    .maybeSingle<any>();

  if (!batch) notFound();

  const [
    { data: statementRaw },
    { data: invoicesRaw },
    { data: matchesRaw },
    { data: auditRaw },
    { data: overridesRaw },
  ] = await Promise.all([
    supabase
      .from('aa_demo_statements' as never)
      .select('*')
      .eq('vendor_id', batch.vendor_id)
      .lte('statement_period_start', batch.period_end)
      .gte('statement_period_end', batch.period_start)
      .order('statement_period_end', { ascending: false })
      .limit(1)
      .maybeSingle<any>(),
    supabase
      .from('aa_demo_invoices' as never)
      .select('*')
      .eq('vendor_id', batch.vendor_id)
      .gte('invoice_date', batch.period_start)
      .lte('invoice_date', batch.period_end)
      .order('invoice_date', { ascending: true }),
    supabase
      .from('aa_demo_reconciliation_matches' as never)
      .select('*')
      .eq('batch_id', id)
      .order('invoice_number', { ascending: true }),
    supabase
      .from('aa_demo_audit_logs' as never)
      .select('id, run_label, model, duration_ms, created_at, raw_output')
      .eq('batch_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('aa_demo_human_overrides' as never)
      .select('*')
      .eq('batch_id', id)
      .order('created_at', { ascending: true }),
  ]);

  return (
    <ReconcileClient
      batch={{
        id: batch.id,
        vendor_name: batch.aa_demo_vendors?.vendor_name ?? 'Vendor',
        period_start: batch.period_start,
        period_end: batch.period_end,
        status: batch.status,
        summary: batch.summary,
        match_rate: batch.match_rate != null ? Number(batch.match_rate) : null,
        warnings: Array.isArray(batch.warnings) ? batch.warnings : [],
        finalized_at: batch.finalized_at ?? null,
        finalized_by: batch.finalized_by ?? null,
        nexsyis_sync_id: batch.nexsyis_sync_id ?? null,
        nexsyis_synced_at: batch.nexsyis_synced_at ?? null,
      }}
      statement={
        statementRaw
          ? {
              total_amount: Number(statementRaw.total_amount),
              period_start: statementRaw.statement_period_start,
              period_end: statementRaw.statement_period_end,
              statement_text: statementRaw.statement_text,
            }
          : null
      }
      invoices={((invoicesRaw ?? []) as any[]).map((i) => ({
        invoice_number: i.invoice_number,
        lk_code: i.lk_code,
        amount: Number(i.amount),
        invoice_date: i.invoice_date,
        status: i.status,
      }))}
      matches={((matchesRaw ?? []) as any[]).map((m) => ({
        invoice_number: m.invoice_number,
        lk_code: m.lk_code,
        system_amount: Number(m.system_amount),
        statement_amount: Number(m.statement_amount),
        difference: Number(m.difference),
        status: m.status,
        confidence: Number(m.confidence),
        reasoning: m.reasoning,
        oddity_flag: m.oddity_flag,
      }))}
      auditLogs={((auditRaw ?? []) as any[]).map((a) => ({
        id: a.id,
        run_label: a.run_label,
        model: a.model,
        duration_ms: a.duration_ms,
        created_at: a.created_at,
        raw_output: a.raw_output,
      }))}
      overrides={((overridesRaw ?? []) as any[]).map((o) => ({
        id: o.id,
        invoice_number: o.invoice_number,
        user_email: o.user_email,
        previous_status: o.previous_status,
        new_status: o.new_status,
        previous_reasoning: o.previous_reasoning,
        new_reasoning: o.new_reasoning,
        note: o.note,
        created_at: o.created_at,
      }))}
    />
  );
}
