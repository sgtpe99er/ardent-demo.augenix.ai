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
  const { error } = await admin
    .from('aa_demo_reconciliation_batches')
    .update({ status: 'needs_review' })
    .eq('id', batchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
