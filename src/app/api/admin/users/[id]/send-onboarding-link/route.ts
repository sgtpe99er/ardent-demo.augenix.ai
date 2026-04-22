import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';
import { sendNotification, generateMagicLinkUrl } from '@/features/emails/send-notification';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: session.user.id } as any);
  return isAdmin ? session : null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;

  // Look up the user's email
  const { data: authUser, error: userError } = await supabaseAdminClient.auth.admin.getUserById(userId);
  if (userError || !authUser?.user?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const email = authUser.user.email;

  // Get business name for personalization
  const { data: business } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('business_name')
    .eq('user_id', userId)
    .maybeSingle();

  const businessName = (business as any)?.business_name || 'there';

  // Generate a magic link that redirects to dashboard
  const dashboardLink = await generateMagicLinkUrl(email);
  if (!dashboardLink) {
    return NextResponse.json({ error: 'Failed to generate magic link' }, { status: 500 });
  }

  // Send the magic-link invite email
  await sendNotification({
    templateKey: 'onboardingInvite',
    to: email,
    vars: {
      business_name: businessName,
      onboarding_link: dashboardLink,
    },
    logLabel: `onboardingInvite → ${email}`,
  });

  // Record timestamp
  await supabaseAdminClient
    .from('aa_demo_businesses')
    .update({ onboarding_link_sent_at: new Date().toISOString() } as any)
    .eq('user_id', userId);

  return NextResponse.json({ success: true });
}
