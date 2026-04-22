/**
 * GET /api/reconcile/[batchId]/export
 * Returns a CSV of consensus reconciliation matches for the batch.
 */
import { getSession } from '@/features/account/controllers/get-session';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

export const runtime = 'nodejs';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { batchId } = await params;
  const id = Number(batchId);
  if (!id || Number.isNaN(id)) {
    return new Response('Invalid batch id', { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: batch } = await supabase
    .from('aa_demo_reconciliation_batches' as never)
    .select('*, aa_demo_vendors(vendor_name)')
    .eq('id', id)
    .maybeSingle<any>();

  const { data: rows } = await supabase
    .from('aa_demo_reconciliation_matches' as never)
    .select('*')
    .eq('batch_id', id)
    .order('invoice_number', { ascending: true });

  const header = [
    'invoice_number',
    'lk_code',
    'system_amount',
    'statement_amount',
    'difference',
    'status',
    'confidence',
    'oddity_flag',
    'reasoning',
  ];

  const lines = [header.join(',')];
  for (const r of (rows ?? []) as any[]) {
    lines.push(
      [
        r.invoice_number,
        r.lk_code,
        r.system_amount,
        r.statement_amount,
        r.difference,
        r.status,
        r.confidence,
        r.oddity_flag,
        r.reasoning,
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  const vendor = batch?.aa_demo_vendors?.vendor_name ?? 'vendor';
  const filename = `reconciliation_${vendor.replace(/\s+/g, '_')}_batch_${id}.csv`;

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
