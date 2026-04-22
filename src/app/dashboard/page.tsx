import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { getSession } from '@/features/account/controllers/get-session';
import { OverviewContent } from './_components/overview-content';
import type { Business, DeployedWebsite, HostingPayment } from '@/types/database';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;
  const userEmail = session.user.email ?? '';
  const supabase = await createSupabaseServerClient();

  const { data: businessRaw } = await supabase
    .from('aa_demo_businesses')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const business = businessRaw as Business | null;

  const [
    { data: deployedWebsiteRaw },
    { data: subscriptionsRaw },
    { data: paymentsRaw },
    { data: selectionRaw },
    { data: feedbackRaw },
  ] = await Promise.all([
    supabase.from('aa_demo_deployed_websites').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('aa_demo_subscriptions')
      .select('id, status, current_period_end')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .maybeSingle(),
    supabase
      .from('aa_demo_hosting_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    business?.id
      ? supabase
          .from('design_selections' as never)
          .select('id, selected_at, notes, variant_id')
          .eq('business_id', business.id)
          .order('selected_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    business?.id
      ? supabase
          .from('preview_feedback' as never)
          .select('id, feedback_text, category, status, created_at')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const deployedWebsite = deployedWebsiteRaw as DeployedWebsite | null;
  const payments = (paymentsRaw ?? []) as HostingPayment[];

  const hasPlan = !!subscriptionsRaw;
  const websiteGuideApprovedAt =
    business && 'website_guide_approved_at' in business
      ? (business.website_guide_approved_at as string | null)
      : null;
  const websiteGuideNeedsApproval = Boolean(business) && !websiteGuideApprovedAt;
  const latestPayment = payments.find((p) => p.status === 'paid') ?? null;
  const hostingEndDate = subscriptionsRaw?.current_period_end ?? latestPayment?.hosting_end_date ?? null;

  return (
    <OverviewContent
      hasPlan={hasPlan}
      business={business}
      deployedWebsite={deployedWebsite}
      websiteGuideNeedsApproval={websiteGuideNeedsApproval}
      hostingEndDate={hostingEndDate}
      userEmail={userEmail}
      selection={(selectionRaw as any) ?? null}
      feedback={(feedbackRaw as any[]) ?? []}
    />
  );
}
