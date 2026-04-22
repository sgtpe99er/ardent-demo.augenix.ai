-- =============================================
-- Ardent Advisors AI - Vendor Statement Reconciliation Demo
-- All tables prefixed aa_demo_
-- =============================================

-- 1. Vendors
create table if not exists aa_demo_vendors (
  id            bigserial primary key,
  vendor_name   text not null,
  location_keys text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- 2. System invoices (from Nexsyis)
create table if not exists aa_demo_invoices (
  id             bigserial primary key,
  vendor_id      bigint not null references aa_demo_vendors(id) on delete cascade,
  invoice_number text not null,
  lk_code        text not null,
  amount         numeric(12,2) not null,
  invoice_date   date not null,
  status         text not null default 'unpaid',
  created_at     timestamptz not null default now()
);
create index if not exists aa_demo_invoices_vendor_idx on aa_demo_invoices(vendor_id);
create index if not exists aa_demo_invoices_date_idx   on aa_demo_invoices(invoice_date);

-- 3. Vendor statements
create table if not exists aa_demo_statements (
  id                     bigserial primary key,
  vendor_id              bigint not null references aa_demo_vendors(id) on delete cascade,
  statement_period_start date not null,
  statement_period_end   date not null,
  total_amount           numeric(12,2) not null,
  statement_text         text not null,
  created_at             timestamptz not null default now()
);

-- 4. Reconciliation batches
create table if not exists aa_demo_reconciliation_batches (
  id           bigserial primary key,
  vendor_id    bigint not null references aa_demo_vendors(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  status       text not null default 'pending', -- pending | running | complete | error
  summary      text,
  match_rate   numeric(5,2),
  warnings     jsonb,
  consensus    jsonb,             -- final consensus JSON
  run_at       timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 5. Per-line reconciliation matches (persisted consensus rows)
create table if not exists aa_demo_reconciliation_matches (
  id               bigserial primary key,
  batch_id         bigint not null references aa_demo_reconciliation_batches(id) on delete cascade,
  invoice_number   text,
  lk_code          text,
  system_amount    numeric(12,2),
  statement_amount numeric(12,2),
  difference       numeric(12,2),
  status           text not null,       -- matched | flagged
  confidence       numeric(5,2),
  reasoning        text,
  oddity_flag      text,
  created_at       timestamptz not null default now()
);
create index if not exists aa_demo_recon_matches_batch_idx on aa_demo_reconciliation_matches(batch_id);

-- 6. Audit logs (all 3 parallel runs + consensus for traceability)
create table if not exists aa_demo_audit_logs (
  id          bigserial primary key,
  batch_id    bigint not null references aa_demo_reconciliation_batches(id) on delete cascade,
  run_label   text not null,          -- 'run_1' | 'run_2' | 'run_3' | 'consensus'
  model       text,
  prompt_hash text,
  raw_output  jsonb,
  duration_ms integer,
  created_at  timestamptz not null default now()
);
create index if not exists aa_demo_audit_logs_batch_idx on aa_demo_audit_logs(batch_id);

-- Trigger: keep updated_at fresh on batches
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_aa_demo_recon_batches_updated_at on aa_demo_reconciliation_batches;
create trigger update_aa_demo_recon_batches_updated_at
before update on aa_demo_reconciliation_batches
for each row execute function update_updated_at_column();

-- =============================================
-- RLS: demo data is shared / read-only for any authenticated user.
-- Writes to batches/matches/audit logs come from server-side service role.
-- =============================================
alter table aa_demo_vendors                   enable row level security;
alter table aa_demo_invoices                  enable row level security;
alter table aa_demo_statements                enable row level security;
alter table aa_demo_reconciliation_batches    enable row level security;
alter table aa_demo_reconciliation_matches    enable row level security;
alter table aa_demo_audit_logs                enable row level security;

create policy "recon vendors readable by authed"    on aa_demo_vendors                for select using (auth.role() = 'authenticated');
create policy "recon invoices readable by authed"   on aa_demo_invoices               for select using (auth.role() = 'authenticated');
create policy "recon statements readable by authed" on aa_demo_statements              for select using (auth.role() = 'authenticated');
create policy "recon batches readable by authed"    on aa_demo_reconciliation_batches  for select using (auth.role() = 'authenticated');
create policy "recon matches readable by authed"    on aa_demo_reconciliation_matches  for select using (auth.role() = 'authenticated');
create policy "recon audit readable by authed"      on aa_demo_audit_logs              for select using (auth.role() = 'authenticated');
