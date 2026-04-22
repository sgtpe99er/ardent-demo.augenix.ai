import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';
import { sendNotification, generateMagicLinkUrl } from '@/features/emails/send-notification';
import { DEFAULT_EMAILS } from '@/app/admin/settings/settings-defaults';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: session.user.id } as any);
  return isAdmin ? session : null;
}

const MAGIC_LINK_TEMPLATES = new Set([
  'welcome',
  'assetsReady',
  'websiteLive',
  'onboardingInvite',
  'paymentConfirmedWithLink',
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;
  const { templateKey } = await req.json();

  if (!templateKey || !DEFAULT_EMAILS[templateKey as keyof typeof DEFAULT_EMAILS]) {
    return NextResponse.json({ error: 'Invalid template key' }, { status: 400 });
  }

  const { data: authUser, error: userError } = await supabaseAdminClient.auth.admin.getUserById(userId);
  if (userError || !authUser?.user?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const email = authUser.user.email;

  const { data: business } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('business_name, deployed_websites(subdomain, custom_domain)')
    .eq('user_id', userId)
    .maybeSingle();

  const businessName = (business as any)?.business_name || 'there';
  const deployedWebsite = (business as any)?.deployed_websites?.[0];
  const websiteUrl = deployedWebsite?.custom_domain
    ? `https://${deployedWebsite.custom_domain}`
    : deployedWebsite?.subdomain
    ? `https://${deployedWebsite.subdomain}.freewebsite.deal`
    : '';

  const vars: Record<string, string> = {
    business_name: businessName,
    website_url: websiteUrl,
    website_link: websiteUrl,
    amount: '',
    hosting_months: '',
    request_description: '',
    complexity: '',
    eta: '',
    dashboard_link: '',
    onboarding_link: '',
  };

  if (MAGIC_LINK_TEMPLATES.has(templateKey)) {
    const link = await generateMagicLinkUrl(email);
    if (link) {
      vars.dashboard_link = link;
      vars.onboarding_link = link;
    }
  }

  await sendNotification({
    templateKey: templateKey as keyof typeof DEFAULT_EMAILS,
    to: email,
    vars,
    logLabel: `manual:${templateKey} → ${email}`,
  });

  return NextResponse.json({ success: true });
}
