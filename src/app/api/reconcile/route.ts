/**
 * POST /api/reconcile
 * Body: { batch_id: number, invoice_number?: string }
 *
 * Returns a streaming NDJSON response. Each line is a JSON object with a
 * `type` field:
 *   - { type: 'start', batch_id, vendor_name }
 *   - { type: 'step_start', step, model }
 *   - { type: 'step_complete', step, model, duration_ms }
 *   - { type: 'step_error', step, model, error }
 *   - { type: 'complete', consensus }
 *   - { type: 'error', error }
 *
 * Runs 3 parallel AI reconciliation runs + 1 consensus run for a given
 * batch. Persists each run (including consensus) to aa_demo_audit_logs,
 * overwrites aa_demo_reconciliation_matches with consensus rows, and
 * updates batch summary/match_rate/status.
 *
 * If invoice_number is provided, only re-runs for that single invoice
 * (line-level "Re-Run AI" action).
 */
import { NextResponse } from 'next/server';

import { getSession } from '@/features/account/controllers/get-session';
import { runReconciliation, type ProgressEvent } from '@/libs/ai/reconcile';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { batch_id?: number; invoice_number?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const batchId = Number(body.batch_id);
  if (!batchId || Number.isNaN(batchId)) {
    return NextResponse.json({ error: 'batch_id required' }, { status: 400 });
  }

  const admin = supabaseAdminClient;

  // Load batch + vendor + statement + invoices
  const { data: batch, error: batchErr } = await admin
    .from('aa_demo_reconciliation_batches')
    .select('*')
    .eq('id', batchId)
    .maybeSingle();
  if (batchErr || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  const [{ data: vendor }, { data: statement }, { data: invoicesRaw }] = await Promise.all([
    admin.from('aa_demo_vendors').select('*').eq('id', batch.vendor_id).maybeSingle(),
    admin
      .from('aa_demo_statements')
      .select('*')
      .eq('vendor_id', batch.vendor_id)
      .gte('statement_period_end', batch.period_start)
      .lte('statement_period_start', batch.period_end)
      .order('statement_period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('aa_demo_invoices')
      .select('*')
      .eq('vendor_id', batch.vendor_id)
      .gte('invoice_date', batch.period_start)
      .lte('invoice_date', batch.period_end)
      .order('invoice_date', { ascending: true }),
  ]);

  if (!vendor || !statement) {
    return NextResponse.json(
      { error: 'Vendor or statement not found for this batch' },
      { status: 404 }
    );
  }

  let invoices = (invoicesRaw ?? []).map((i: any) => ({
    invoice_number: i.invoice_number,
    lk_code: i.lk_code,
    amount: Number(i.amount),
    invoice_date: i.invoice_date,
    status: i.status,
  }));

  if (body.invoice_number) {
    invoices = invoices.filter((i) => i.invoice_number === body.invoice_number);
    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found in batch' }, { status: 404 });
    }
  }

  // Mark running
  await admin
    .from('aa_demo_reconciliation_batches')
    .update({ status: 'running' })
    .eq('id', batchId);

  // Stream NDJSON progress events to the client while the reconciliation runs.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      emit({ type: 'start', batch_id: batchId, vendor_name: vendor.vendor_name });

      try {
        const bundle = await runReconciliation(
          {
            vendor_name: vendor.vendor_name,
            period_start: batch.period_start,
            period_end: batch.period_end,
            statement_total: Number(statement.total_amount),
            statement_text: statement.statement_text,
            invoices,
          },
          (event: ProgressEvent) => {
            emit(event);
          }
        );

        // Persist audit logs (3 runs + consensus)
        const auditRows = [
          ...bundle.runs.map((r) => ({
            batch_id: batchId,
            run_label: r.label,
            model: r.model,
            raw_output: r.result as any,
            duration_ms: r.duration_ms,
          })),
          {
            batch_id: batchId,
            run_label: 'consensus',
            model: bundle.consensus.model,
            raw_output: bundle.consensus.result as any,
            duration_ms: bundle.consensus.duration_ms,
          },
        ];
        await admin.from('aa_demo_audit_logs').insert(auditRows);

        // If line-level: upsert single row. Otherwise replace all matches.
        if (body.invoice_number) {
          const row = bundle.consensus.result.matches[0];
          if (row) {
            await admin
              .from('aa_demo_reconciliation_matches')
              .delete()
              .eq('batch_id', batchId)
              .eq('invoice_number', row.invoice_number);
            await admin.from('aa_demo_reconciliation_matches').insert([
              {
                batch_id: batchId,
                invoice_number: row.invoice_number,
                lk_code: row.lk_code,
                system_amount: row.system_amount,
                statement_amount: row.statement_amount,
                difference: row.difference,
                status: row.status,
                confidence: row.confidence,
                reasoning: row.reasoning,
                oddity_flag: row.oddity_flag,
              },
            ]);
          }
        } else {
          await admin.from('aa_demo_reconciliation_matches').delete().eq('batch_id', batchId);
          const matchRows = bundle.consensus.result.matches.map((m) => ({
            batch_id: batchId,
            invoice_number: m.invoice_number,
            lk_code: m.lk_code,
            system_amount: m.system_amount,
            statement_amount: m.statement_amount,
            difference: m.difference,
            status: m.status,
            confidence: m.confidence,
            reasoning: m.reasoning,
            oddity_flag: m.oddity_flag,
          }));
          if (matchRows.length > 0) {
            await admin.from('aa_demo_reconciliation_matches').insert(matchRows);
          }
          await admin
            .from('aa_demo_reconciliation_batches')
            .update({
              status: 'complete',
              summary: bundle.consensus.result.summary,
              match_rate: bundle.consensus.result.overall_match_rate,
              warnings: bundle.consensus.result.warnings as any,
              consensus: bundle.consensus.result as any,
              run_at: new Date().toISOString(),
            })
            .eq('id', batchId);
        }

        emit({
          type: 'complete',
          batch_id: batchId,
          consensus: bundle.consensus.result,
        });
      } catch (err) {
        console.error('[reconcile] failed:', err);
        const message = (err as Error).message;
        await admin
          .from('aa_demo_reconciliation_batches')
          .update({ status: 'error', summary: message })
          .eq('id', batchId);
        emit({ type: 'error', batch_id: batchId, error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
