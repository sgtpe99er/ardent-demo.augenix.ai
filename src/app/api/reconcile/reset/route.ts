/**
 * POST /api/reconcile/reset
 *
 * Resets all reconciliation state back to the original seeded "pending"
 * state so the demo can be run again from scratch.
 *
 * Safe to call repeatedly. Only touches reconciliation tables; vendors,
 * invoices, and statements remain untouched.
 */
import { NextResponse } from 'next/server';

import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdminClient;

  // Order matters: children first (FK cascade would also handle this, but be explicit).
  await admin.from('aa_demo_audit_logs').delete().gte('id', 0);
  await admin.from('aa_demo_reconciliation_matches').delete().gte('id', 0);
  await admin.from('aa_demo_reconciliation_batches').delete().gte('id', 0);

  // Re-create one pending batch per vendor for the standard demo period.
  const { data: vendors, error: vendorErr } = await admin
    .from('aa_demo_vendors')
    .select('id')
    .order('id', { ascending: true });
  if (vendorErr) {
    return NextResponse.json({ error: vendorErr.message }, { status: 500 });
  }

  const rows = (vendors ?? []).map((v: { id: number }) => ({
    vendor_id: v.id,
    period_start: '2026-04-01',
    period_end: '2026-04-30',
    status: 'pending',
  }));

  if (rows.length > 0) {
    const { error: insertErr } = await admin
      .from('aa_demo_reconciliation_batches')
      .insert(rows);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, batches_created: rows.length });
}
