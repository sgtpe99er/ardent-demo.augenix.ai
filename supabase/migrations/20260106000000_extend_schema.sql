/**
 * BUSINESSES
 * Stores business information collected during onboarding
 */
create table aa_demo_businesses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null unique,
  business_name text,
  industry text,
  location_city text,
  location_state text,
  location_country text,
  target_audience text,
  services_products text,
  website_features text[],
  -- Status: onboarding, paid, assets_generating, assets_ready, approved, active
  status text default 'onboarding' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_businesses enable row level security;
create policy "Users can view own business data." on aa_demo_businesses for select using (auth.uid() = user_id);
create policy "Users can insert own business data." on aa_demo_businesses for insert with check (auth.uid() = user_id);
create policy "Users can update own business data." on aa_demo_businesses for update using (auth.uid() = user_id);

/**
 * ONBOARDING_RESPONSES
 * Stores detailed onboarding form responses including file references
 */
create table aa_demo_onboarding_responses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  business_id uuid references aa_demo_businesses,
  step integer not null,
  responses jsonb not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_onboarding_responses enable row level security;
create policy "Users can view own onboarding responses." on aa_demo_onboarding_responses for select using (auth.uid() = user_id);
create policy "Users can insert own onboarding responses." on aa_demo_onboarding_responses for insert with check (auth.uid() = user_id);
create policy "Users can update own onboarding responses." on aa_demo_onboarding_responses for update using (auth.uid() = user_id);

/**
 * BRAND_ASSETS
 * Stores existing brand assets uploaded by user or preferences if none exist
 */
create table aa_demo_brand_assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  business_id uuid references aa_demo_businesses,
  -- Existing assets
  has_existing_website boolean default false,
  existing_website_url text,
  has_existing_logo boolean default false,
  existing_logo_url text,
  has_brand_colors boolean default false,
  brand_colors text[],
  has_brand_fonts boolean default false,
  brand_fonts text[],
  -- Preferences (if no existing assets)
  style_preference text, -- modern, classic, fun, professional, etc.
  color_preference text,
  font_preference text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_brand_assets enable row level security;
create policy "Users can view own brand assets." on aa_demo_brand_assets for select using (auth.uid() = user_id);
create policy "Users can insert own brand assets." on aa_demo_brand_assets for insert with check (auth.uid() = user_id);
create policy "Users can update own brand assets." on aa_demo_brand_assets for update using (auth.uid() = user_id);

/**
 * DOMAIN_REQUESTS
 * Stores domain purchase requests and status
 */
create table aa_demo_domain_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  business_id uuid references aa_demo_businesses,
  needs_domain boolean default false,
  requested_domain text,
  domain_price numeric(10,2),
  markup_fee numeric(10,2) default 5.00,
  -- Status: pending, purchased, configured, failed
  status text default 'pending',
  namecheap_order_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_domain_requests enable row level security;
create policy "Users can view own domain requests." on aa_demo_domain_requests for select using (auth.uid() = user_id);
create policy "Users can insert own domain requests." on aa_demo_domain_requests for insert with check (auth.uid() = user_id);
create policy "Users can update own domain requests." on aa_demo_domain_requests for update using (auth.uid() = user_id);

/**
 * GENERATED_ASSETS
 * Stores AI-generated assets (logos, branding guides, website mockups)
 */
create type asset_type as enum ('logo', 'branding_guide', 'website_mockup', 'color_palette', 'font_selection');
create type asset_status as enum ('pending', 'generating', 'ready', 'approved', 'rejected');

create table aa_demo_generated_assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  business_id uuid references aa_demo_businesses,
  asset_type asset_type not null,
  -- URL to the asset in Supabase Storage
  storage_url text,
  -- Additional metadata (prompts used, generation params, etc.)
  metadata jsonb default '{}',
  status asset_status default 'pending',
  is_selected boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_generated_assets enable row level security;
create policy "Users can view own generated assets." on aa_demo_generated_assets for select using (auth.uid() = user_id);
create policy "Users can update own generated assets." on aa_demo_generated_assets for update using (auth.uid() = user_id);

/**
 * EDIT_REQUESTS
 * Tracks monthly edit requests (limit 10/month)
 */
create type edit_request_status as enum ('pending', 'in_progress', 'completed', 'rejected');

create table aa_demo_edit_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  business_id uuid references aa_demo_businesses,
  request_description text not null,
  -- For tracking which page/section to edit
  target_page text,
  status edit_request_status default 'pending',
  -- Admin notes
  admin_notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_edit_requests enable row level security;
create policy "Users can view own edit requests." on aa_demo_edit_requests for select using (auth.uid() = user_id);
create policy "Users can insert own edit requests." on aa_demo_edit_requests for insert with check (auth.uid() = user_id);

/**
 * DEPLOYED_WEBSITES
 * Tracks deployed customer websites
 */
create type website_status as enum ('building', 'deployed', 'failed', 'suspended');

create table aa_demo_deployed_websites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  business_id uuid references aa_demo_businesses,
  -- Vercel deployment info
  vercel_project_id text,
  vercel_deployment_id text,
  -- URLs
  subdomain text,
  custom_domain text,
  live_url text,
  status website_status default 'building',
  deployed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_deployed_websites enable row level security;
create policy "Users can view own deployed websites." on aa_demo_deployed_websites for select using (auth.uid() = user_id);

/**
 * HOSTING_PAYMENTS
 * Tracks one-time hosting payments (6 or 12 months)
 */
create table aa_demo_hosting_payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  business_id uuid references aa_demo_businesses,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  -- 6 or 12 months
  hosting_months integer not null,
  amount numeric(10,2) not null,
  domain_fee numeric(10,2) default 0,
  total_amount numeric(10,2) not null,
  -- Payment status
  status text default 'pending',
  paid_at timestamp with time zone,
  -- Hosting period
  hosting_start_date timestamp with time zone,
  hosting_end_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_hosting_payments enable row level security;
create policy "Users can view own hosting payments." on aa_demo_hosting_payments for select using (auth.uid() = user_id);

/**
 * UPSELL_SUBSCRIPTIONS
 * Tracks upsell service subscriptions (SEO, Google Ads, GMB)
 */
create type upsell_service as enum ('seo', 'google_ads', 'google_my_business');

create table aa_demo_upsell_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  business_id uuid references aa_demo_businesses,
  service upsell_service not null,
  stripe_subscription_id text,
  monthly_price numeric(10,2) not null,
  -- Discount applied (e.g., 20% bundle discount)
  discount_percent numeric(5,2) default 0,
  status text default 'active',
  started_at timestamp with time zone default timezone('utc'::text, now()),
  canceled_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_upsell_subscriptions enable row level security;
create policy "Users can view own upsell subscriptions." on aa_demo_upsell_subscriptions for select using (auth.uid() = user_id);

/**
 * ADMIN_USERS
 * Tracks which users have admin access
 */
create table aa_demo_admin_users (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table aa_demo_admin_users enable row level security;
-- Admins can view admin_users table
create policy "Admins can view admin users." on aa_demo_admin_users for select using (
  auth.uid() in (select user_id from aa_demo_admin_users)
);

/**
 * Helper function to check if user is admin
 */
create or replace function is_admin(user_uuid uuid)
returns boolean as $$
begin
  return exists (select 1 from aa_demo_admin_users where user_id = user_uuid);
end;
$$ language plpgsql security definer;

/**
 * Admin policies for viewing all data
 */
create policy "Admins can view all businesses." on aa_demo_businesses for select using (is_admin(auth.uid()));
create policy "Admins can update all businesses." on aa_demo_businesses for update using (is_admin(auth.uid()));
create policy "Admins can view all onboarding responses." on aa_demo_onboarding_responses for select using (is_admin(auth.uid()));
create policy "Admins can view all brand assets." on aa_demo_brand_assets for select using (is_admin(auth.uid()));
create policy "Admins can view all generated assets." on aa_demo_generated_assets for select using (is_admin(auth.uid()));
create policy "Admins can update all generated assets." on aa_demo_generated_assets for update using (is_admin(auth.uid()));
create policy "Admins can insert generated assets." on aa_demo_generated_assets for insert with check (is_admin(auth.uid()));
create policy "Admins can view all edit requests." on aa_demo_edit_requests for select using (is_admin(auth.uid()));
create policy "Admins can update all edit requests." on aa_demo_edit_requests for update using (is_admin(auth.uid()));
create policy "Admins can view all deployed websites." on aa_demo_deployed_websites for select using (is_admin(auth.uid()));
create policy "Admins can update all deployed websites." on aa_demo_deployed_websites for update using (is_admin(auth.uid()));
create policy "Admins can insert deployed websites." on aa_demo_deployed_websites for insert with check (is_admin(auth.uid()));
create policy "Admins can view all hosting payments." on aa_demo_hosting_payments for select using (is_admin(auth.uid()));
create policy "Admins can view all upsell subscriptions." on aa_demo_upsell_subscriptions for select using (is_admin(auth.uid()));
create policy "Admins can view all domain requests." on aa_demo_domain_requests for select using (is_admin(auth.uid()));
create policy "Admins can update all domain requests." on aa_demo_domain_requests for update using (is_admin(auth.uid()));

/**
 * Trigger to update updated_at timestamp
 */
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger update_businesses_updated_at before update on aa_demo_businesses
  for each row execute function update_updated_at_column();
create trigger update_onboarding_responses_updated_at before update on aa_demo_onboarding_responses
  for each row execute function update_updated_at_column();
create trigger update_brand_assets_updated_at before update on aa_demo_brand_assets
  for each row execute function update_updated_at_column();
create trigger update_domain_requests_updated_at before update on aa_demo_domain_requests
  for each row execute function update_updated_at_column();
create trigger update_generated_assets_updated_at before update on aa_demo_generated_assets
  for each row execute function update_updated_at_column();
create trigger update_edit_requests_updated_at before update on aa_demo_edit_requests
  for each row execute function update_updated_at_column();
create trigger update_deployed_websites_updated_at before update on aa_demo_deployed_websites
  for each row execute function update_updated_at_column();

/**
 * Function to count edit requests in current month
 */
create or replace function get_monthly_edit_count(user_uuid uuid)
returns integer as $$
declare
  edit_count integer;
begin
  select count(*) into edit_count
  from aa_demo_edit_requests
  where user_id = user_uuid
    and created_at >= date_trunc('month', current_timestamp)
    and created_at < date_trunc('month', current_timestamp) + interval '1 month';
  return edit_count;
end;
$$ language plpgsql security definer;

/**
 * Function to check if user has paid for hosting
 */
create or replace function has_paid_hosting(user_uuid uuid)
returns boolean as $$
begin
  return exists (
    select 1 from aa_demo_hosting_payments 
    where user_id = user_uuid 
      and status = 'paid'
      and hosting_end_date > current_timestamp
  );
end;
$$ language plpgsql security definer;
