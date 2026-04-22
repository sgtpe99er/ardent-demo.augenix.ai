/**
 * POST /api/reconcile/[batchId]/finalize
 *
 * Locks a reviewed batch. Moves status needs_review -> complete, records
 * finalized_at/by, flips every in-batch invoice to status='ready_to_pay',
 * and writes a 'finalize' audit log row for the edit-history timeline.
 *
 * Body: { acknowledged: boolean }  -- must be true (checkbox gate)
 */
import { NextResponse } from 'next/server';

import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
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

  let body: { acknowledged?: boolean };
  try {
    body = (await request.json()) as { acknowledged?: boolean };
  } catch {
    body = {};
  }
  if (!body.acknowledged) {
    return NextResponse.json(
      { error: 'You must acknowledge that you have reviewed all oddities and overrides.' },
      { status: 400 }
    );
  }

  const admin = supabaseAdminClient;

  const { data: batch, error: batchErr } = await admin
    .from('aa_demo_reconciliation_batches')
    .select('id, vendor_id, status, match_rate, summary, period_start, period_end, warnings')
    .eq('id', batchId)
    .maybeSingle();
  if (batchErr || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }
  if (batch.status === 'pending' || batch.status === 'running') {
    return NextResponse.json(
      { error: 'Batch has not finished reconciliation yet.' },
      { status: 400 }
    );
  }
  if (batch.status === 'complete' && (batch as any).finalized_at) {
    return NextResponse.json({ error: 'Batch is already finalized.' }, { status: 400 });
  }

  const finalizedAt = new Date().toISOString();
  const finalizedBy = session.user.email ?? 'unknown';

  // 1. Update batch row.
  const { error: updateErr } = await admin
    .from('aa_demo_reconciliation_batches')
    .update({
      status: 'complete',
      finalized_at: finalizedAt,
      finalized_by: finalizedBy,
    })
    .eq('id', batchId);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 2. Mark every invoice in the batch period as ready_to_pay.
  const { data: invoicesRaw } = await admin
    .from('aa_demo_invoices')
    .select('id')
    .eq('vendor_id', batch.vendor_id)
    .gte('invoice_date', batch.period_start)
    .lte('invoice_date', batch.period_end);
  const invoiceIds = (invoicesRaw ?? []).map((i: any) => i.id);
  if (invoiceIds.length > 0) {
    await admin
      .from('aa_demo_invoices')
      .update({ status: 'ready_to_pay' })
      .in('id', invoiceIds);
  }

  // 3. Audit log entry.
  await admin.from('aa_demo_audit_logs').insert([
    {
      batch_id: batchId,
      run_label: 'finalize',
      model: null,
      duration_ms: null,
      raw_output: {
        finalized_by: finalizedBy,
        finalized_at: finalizedAt,
        invoice_count: invoiceIds.length,
        match_rate: batch.match_rate,
        summary: batch.summary,
        warnings: batch.warnings,
      } as any,
    },
  ]);

  return NextResponse.json({
    ok: true,
    finalized_at: finalizedAt,
    finalized_by: finalizedBy,
    invoice_count: invoiceIds.length,
  });
}
