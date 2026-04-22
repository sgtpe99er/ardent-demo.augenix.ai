/**
 * POST /api/reconcile/[batchId]/sync-to-nexsyis
 *
 * Simulated write-back to Nexsyis. Generates a mock transaction id, stores
 * it on the batch, adds a 'nexsyis_sync' audit row, and returns the id.
 *
 * NOTE: No real Nexsyis integration exists yet. This is a demo placeholder
 * that lets the Office Manager see what the post-finalize handoff will
 * feel like once the integration is wired up.
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

  const { data: batch } = await admin
    .from('aa_demo_reconciliation_batches')
    .select('id, status, finalized_at')
    .eq('id', batchId)
    .maybeSingle();
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }
  if (batch.status !== 'complete' || !(batch as any).finalized_at) {
    return NextResponse.json(
      { error: 'Batch must be finalized before syncing to Nexsyis.' },
      { status: 400 }
    );
  }

  // Generate a deterministic-looking fake Nexsyis transaction id.
  const syncId = `NX-${new Date().toISOString().slice(0, 10)}-${Math.floor(
    Math.random() * 9000 + 1000
  )}`;
  const syncedAt = new Date().toISOString();

  await admin
    .from('aa_demo_reconciliation_batches')
    .update({ nexsyis_sync_id: syncId, nexsyis_synced_at: syncedAt })
    .eq('id', batchId);

  await admin.from('aa_demo_audit_logs').insert([
    {
      batch_id: batchId,
      run_label: 'nexsyis_sync',
      model: null,
      duration_ms: null,
      raw_output: {
        synced_by: session.user.email ?? 'unknown',
        synced_at: syncedAt,
        nexsyis_sync_id: syncId,
        simulated: true,
      } as any,
    },
  ]);

  return NextResponse.json({
    ok: true,
    nexsyis_sync_id: syncId,
    synced_at: syncedAt,
  });
}
