-- =============================================
-- Human-in-the-loop overrides for reconciliation matches.
-- Every time a user edits a match row we persist an override record so
-- the edit history can show who changed what, when, and why.
-- =============================================
create table if not exists aa_demo_human_overrides (
  id                 bigserial primary key,
  batch_id           bigint not null references aa_demo_reconciliation_batches(id) on delete cascade,
  invoice_number     text,
  user_email         text,
  previous_status    text,
  new_status         text,
  previous_reasoning text,
  new_reasoning      text,
  note               text,
  created_at         timestamptz not null default now()
);
create index if not exists aa_demo_human_overrides_batch_idx on aa_demo_human_overrides(batch_id);

alter table aa_demo_human_overrides enable row level security;

create policy "recon overrides readable by authed"
  on aa_demo_human_overrides
  for select
  using (auth.role() = 'authenticated');
