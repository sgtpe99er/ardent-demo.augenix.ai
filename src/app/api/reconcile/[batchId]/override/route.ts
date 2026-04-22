/**
 * POST /api/reconcile/[batchId]/override
 *
 * Record a human override for a single reconciliation match. Updates the
 * match row and appends an immutable audit row to aa_demo_human_overrides.
 *
 * Body: { invoice_number: string, new_status?: 'matched' | 'flagged',
 *         new_reasoning?: string, note?: string }
 */
import { NextResponse } from 'next/server';

import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export const runtime = 'nodejs';

interface OverrideBody {
  invoice_number?: string;
  new_status?: 'matched' | 'flagged';
  new_reasoning?: string;
  note?: string;
}

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

  let body: OverrideBody;
  try {
    body = (await request.json()) as OverrideBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.invoice_number) {
    return NextResponse.json({ error: 'invoice_number required' }, { status: 400 });
  }
  if (!body.new_status && !body.new_reasoning) {
    return NextResponse.json(
      { error: 'Must change at least one of status or reasoning' },
      { status: 400 }
    );
  }
  if (body.new_status && !['matched', 'flagged'].includes(body.new_status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
  }

  const admin = supabaseAdminClient;

  const { data: existing, error: fetchErr } = await admin
    .from('aa_demo_reconciliation_matches')
    .select('status, reasoning')
    .eq('batch_id', batchId)
    .eq('invoice_number', body.invoice_number)
    .maybeSingle();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Match row not found' }, { status: 404 });
  }

  const nextStatus = body.new_status ?? existing.status;
  const nextReasoning = body.new_reasoning ?? existing.reasoning;

  const { error: updateErr } = await admin
    .from('aa_demo_reconciliation_matches')
    .update({ status: nextStatus, reasoning: nextReasoning })
    .eq('batch_id', batchId)
    .eq('invoice_number', body.invoice_number);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { error: auditErr } = await admin.from('aa_demo_human_overrides').insert([
    {
      batch_id: batchId,
      invoice_number: body.invoice_number,
      user_email: session.user.email ?? null,
      previous_status: existing.status,
      new_status: nextStatus,
      previous_reasoning: existing.reasoning,
      new_reasoning: nextReasoning,
      note: body.note ?? null,
    },
  ]);
  if (auditErr) {
    return NextResponse.json({ error: auditErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
