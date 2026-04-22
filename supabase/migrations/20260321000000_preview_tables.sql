-- Phase 1A: Preview system tables
-- design_variants, design_selections, preview_feedback

-- Tracks the 3 home page design variants per business
create table if not exists design_variants (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references aa_demo_businesses(id) on delete cascade,
  deployed_website_id  uuid references deployed_websites(id) on delete set null,
  variant_number       int not null check (variant_number between 1 and 3),
  label                text not null,
  vercel_deployment_url text,
  github_branch        text not null,
  thumbnail_url        text,
  status               text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (business_id, variant_number)
);

-- Records which design variant a user selected
create table if not exists design_selections (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references aa_demo_businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  variant_id  uuid not null references design_variants(id) on delete cascade,
  selected_at timestamptz not null default now(),
  notes       text
);

-- Stores free-form preview feedback from users
create table if not exists preview_feedback (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references aa_demo_businesses(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  variant_id    uuid references design_variants(id) on delete set null,
  feedback_text text not null,
  category      text not null default 'other' check (category in ('design', 'content', 'layout', 'other')),
  status        text not null default 'new' check (status in ('new', 'acknowledged', 'resolved')),
  created_at    timestamptz not null default now()
);

-- RLS: service role bypasses; user can only see their own business data
alter table design_variants enable row level security;
alter table design_selections enable row level security;
alter table preview_feedback enable row level security;

create policy "design_variants_owner" on design_variants
  for all using (
    business_id in (select id from businesses where user_id = auth.uid())
  );

create policy "design_selections_owner" on design_selections
  for all using (user_id = auth.uid());

create policy "preview_feedback_owner" on preview_feedback
  for all using (user_id = auth.uid());

-- Indexes
create index if not exists design_variants_business_id_idx on design_variants(business_id);
create index if not exists design_variants_deployed_website_id_idx on design_variants(deployed_website_id);
create index if not exists design_selections_business_id_idx on design_selections(business_id);
create index if not exists preview_feedback_business_id_idx on preview_feedback(business_id);
create index if not exists preview_feedback_variant_id_idx on preview_feedback(variant_id);
