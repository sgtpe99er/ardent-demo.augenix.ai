/**
 * POST /api/reconcile/[batchId]/unfinalize
 *
 * Reverts a completed batch to the "needs_review" state. Existing matches
 * and audit logs are preserved; the batch simply becomes editable and
 * re-runnable again.
 */
import { NextResponse } from 'next/server';

import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { batchId: batchIdRaw } = await params;
  const batchId = Number(batchIdRaw);
  if (!batchId || Number.isNaN(batchId)) {
    return NextResponse.json({ error: 'Invalid batch id' }, { status: 400 });
  }

  const admin = supabaseAdminClient;

  // Revert batch state.
  const { data: batch, error } = await admin
    .from('aa_demo_reconciliation_batches')
    .update({
      status: 'needs_review',
      finalized_at: null,
      finalized_by: null,
      nexsyis_sync_id: null,
      nexsyis_synced_at: null,
    })
    .eq('id', batchId)
    .select('vendor_id, period_start, period_end')
    .maybeSingle();

  if (error || !batch) {
    return NextResponse.json({ error: error?.message ?? 'Batch not found' }, { status: 500 });
  }

  // Flip invoices back to unpaid.
  await admin
    .from('aa_demo_invoices')
    .update({ status: 'unpaid' })
    .eq('vendor_id', batch.vendor_id)
    .gte('invoice_date', batch.period_start)
    .lte('invoice_date', batch.period_end);

  // Audit row so the un-finalize shows up in edit history.
  await admin.from('aa_demo_audit_logs').insert([
    {
      batch_id: batchId,
      run_label: 'unfinalize',
      model: null,
      duration_ms: null,
      raw_output: {
        unfinalized_by: session.user.email ?? 'unknown',
        unfinalized_at: new Date().toISOString(),
      } as any,
    },
  ]);

  return NextResponse.json({ ok: true });
}
