import { PropsWithChildren } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/features/account/controllers/get-session';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { verifyImpersonationToken, IMPERSONATE_COOKIE } from '@/utils/impersonation';
import { DashboardLayoutClient } from './_components/dashboard-layout-client';

export default async function DashboardLayout({ children }: PropsWithChildren) {
  const session = await getSession();
  if (!session) redirect('/login');

  // Resolve the user whose data the dashboard should display
  let viewAsUserId = session.user.id;
  let viewAsEmail = session.user.email ?? '';
  let impersonatingAdminEmail: string | undefined;

  const cookieStore = await cookies();
  const impersonateCookie = cookieStore.get(IMPERSONATE_COOKIE)?.value;

  if (impersonateCookie) {
    const claims = verifyImpersonationToken(impersonateCookie);
    if (claims && claims.adminId === session.user.id) {
      const supabase = await createSupabaseServerClient();
      const { data: isAdmin } = await supabase.rpc('is_admin', {
        user_uuid: session.user.id,
      } as any);

      if (isAdmin) {
        const { data: targetAuth } = await supabaseAdminClient.auth.admin.getUserById(
          claims.targetUserId
        );
        if (targetAuth?.user) {
          viewAsUserId = claims.targetUserId;
          viewAsEmail = targetAuth.user.email ?? '';
          impersonatingAdminEmail = session.user.email ?? '';
        }
      }
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: business } = await supabase
    .from('aa_demo_businesses')
    .select('business_name')
    .eq('user_id', viewAsUserId)
    .maybeSingle();

  return (
    <DashboardLayoutClient
      businessName={business?.business_name ?? null}
      userEmail={viewAsEmail}
      impersonatingAdminEmail={impersonatingAdminEmail}
    >
      {children}
    </DashboardLayoutClient>
  );
}
