import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { requireAdmin } from '../../require-admin';
import { CustomerDetail } from './customer-detail';

interface CustomerDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createSupabaseServerClient();

  // Fetch real user email via admin API — also validates the user exists
  const { data: authUser } = await supabaseAdminClient.auth.admin.getUserById(id);
  if (!authUser?.user) {
    notFound();
  }
  const email = authUser.user.email ?? '';

  // Fetch customer data (may be null for admin users with no business)
  const { data: business } = await supabase
    .from('aa_demo_businesses')
    .select('*')
    .eq('user_id', id)
    .single();

  // Fetch onboarding responses
  const { data: onboardingResponses } = await supabase
    .from('aa_demo_onboarding_responses')
    .select('*')
    .eq('user_id', id)
    .order('step', { ascending: true });

  // Fetch brand assets
  const { data: brandAssets } = await supabase
    .from('aa_demo_brand_assets')
    .select('*')
    .eq('user_id', id)
    .single();

  // Fetch domain requests
  const { data: domainRequests } = await supabase
    .from('aa_demo_domain_requests')
    .select('*')
    .eq('user_id', id);

  // Fetch generated assets
  const { data: generatedAssets } = await supabase
    .from('aa_demo_generated_assets')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  // Fetch customer inputs (uploaded assets + reference URLs)
  const { data: customerInputs } = await supabase
    .from('customer_inputs' as any)
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  // Fetch edit requests
  const { data: editRequests } = await supabase
    .from('aa_demo_edit_requests')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  // Fetch hosting payments
  const { data: hostingPayments } = await supabase
    .from('aa_demo_hosting_payments')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  // Fetch deployed website
  const { data: deployedWebsite } = await supabase
    .from('aa_demo_deployed_websites')
    .select('*')
    .eq('user_id', id)
    .single();

  // Fetch wordpress migration jobs
  const { data: migrationJobs } = await supabase
    .from('migration_jobs' as any)
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  const customerData: any = {
    userId: id,
    email: email,
    business: business ?? null,
    onboardingResponses: onboardingResponses || [],
    brandAssets,
    domainRequests: domainRequests || [],
    generatedAssets: generatedAssets || [],
    customerInputs: (customerInputs as any) || [],
    editRequests: editRequests || [],
    hostingPayments: hostingPayments || [],
    deployedWebsite,
    migrationJobs: migrationJobs || [],
  };

  return <CustomerDetail data={customerData} isAdmin={true} />;
}
