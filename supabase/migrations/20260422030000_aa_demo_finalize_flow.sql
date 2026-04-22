-- =============================================
-- Finalize flow: a batch reaches 'needs_review' after reconciliation and
-- only becomes 'complete' when the Office Manager explicitly Finalizes it.
-- =============================================
alter table aa_demo_reconciliation_batches
  add column if not exists finalized_at    timestamptz,
  add column if not exists finalized_by    text,
  add column if not exists nexsyis_sync_id text,
  add column if not exists nexsyis_synced_at timestamptz;
