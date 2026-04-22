-- Add ON DELETE CASCADE to all FK constraints referencing auth.users
-- so that deleting a user from auth cascades to all related tables.

DO $$
DECLARE
  tables_cols text[][] := ARRAY[
    ARRAY['aa_demo_users',                 'id',      'aa_demo_users_id_fkey'],
    ARRAY['aa_demo_customers',             'id',      'aa_demo_customers_id_fkey'],
    ARRAY['aa_demo_subscriptions',         'user_id', 'aa_demo_subscriptions_user_id_fkey'],
    ARRAY['aa_demo_businesses',            'user_id', 'aa_demo_businesses_user_id_fkey'],
    ARRAY['aa_demo_onboarding_responses',  'user_id', 'aa_demo_onboarding_responses_user_id_fkey'],
    ARRAY['aa_demo_brand_assets',          'user_id', 'aa_demo_brand_assets_user_id_fkey'],
    ARRAY['aa_demo_domain_requests',       'user_id', 'aa_demo_domain_requests_user_id_fkey'],
    ARRAY['aa_demo_generated_assets',      'user_id', 'aa_demo_generated_assets_user_id_fkey'],
    ARRAY['aa_demo_edit_requests',         'user_id', 'aa_demo_edit_requests_user_id_fkey'],
    ARRAY['aa_demo_deployed_websites',     'user_id', 'aa_demo_deployed_websites_user_id_fkey'],
    ARRAY['aa_demo_hosting_payments',      'user_id', 'aa_demo_hosting_payments_user_id_fkey'],
    ARRAY['aa_demo_upsell_subscriptions',  'user_id', 'aa_demo_upsell_subscriptions_user_id_fkey'],
    ARRAY['aa_demo_admin_users',           'user_id', 'aa_demo_admin_users_user_id_fkey'],
    ARRAY['aa_demo_customer_inputs',       'user_id', 'aa_demo_customer_inputs_user_id_fkey'],
    ARRAY['aa_demo_customer_input_folders','user_id', 'aa_demo_customer_input_folders_user_id_fkey']
  ];
  t text[];
  tbl text;
  col text;
  con text;
BEGIN
  FOREACH t SLICE 1 IN ARRAY tables_cols LOOP
    tbl := t[1];
    col := t[2];
    con := t[3];

    -- Only proceed if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- Drop old constraint if it exists
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = tbl AND constraint_name = con
      ) THEN
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, con);
      END IF;

      -- Re-add with ON DELETE CASCADE
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
        tbl, con, col
      );
    END IF;
  END LOOP;
END
$$;
