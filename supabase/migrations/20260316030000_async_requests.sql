-- Async request queue for FWD agent-driven workflows.
-- Agents poll on heartbeat, claim atomically, and update status on completion/failure.

create table async_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references aa_demo_businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,

  -- Task classification
  task_type text not null,
  -- Values: 'logo_generation', 'logo_refresh', 'edit_request', 'website_generation',
  --         'web_discovery', 'domain_purchase', 'wp_migration', 'branding_guide', 'site_provision'
  priority int not null default 100,  -- lower number = higher priority

  -- Payload (task-specific input data)
  payload jsonb not null default '{}',

  -- Status tracking
  status text not null default 'pending',
  -- Values: 'pending', 'claimed', 'processing', 'completed', 'failed', 'cancelled'
  claimed_by text,    -- agent identifier
  claimed_at timestamptz,

  -- Results
  result jsonb,       -- task-specific output on success
  error text,         -- failure reason if failed
  retry_count int not null default 0,
  max_retries int not null default 3,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Index for agent polling (the hot query path: pending tasks by type, priority-ordered)
create index idx_async_requests_pending
  on async_requests (task_type, priority, created_at)
  where status = 'pending';

-- Index for admin dashboard (status + recency)
create index idx_async_requests_status
  on async_requests (status, created_at desc);

-- Index for user's view of their requests
create index idx_async_requests_user
  on async_requests (user_id, created_at desc);

-- RLS: admins see all; users see only their own
alter table async_requests enable row level security;

create policy "admins can do anything on async_requests"
  on async_requests
  for all
  using (
    exists (
      select 1 from admin_users au
      where au.user_id = auth.uid()
    )
  );

create policy "users can view their own async_requests"
  on async_requests
  for select
  using (user_id = auth.uid());
