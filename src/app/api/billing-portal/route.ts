import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { stripeAdmin } from '@/libs/stripe/stripe-admin';

export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!stripeAdmin) return Response.json({ error: 'Stripe not configured' }, { status: 503 });

  // Look up the Stripe customer ID
  const { data: customer } = await supabaseAdminClient
    .from('aa_demo_customers')
    .select('stripe_customer_id')
    .eq('id', session.user.id)
    .single();

  if (!customer?.stripe_customer_id) {
    return Response.json({ error: 'No billing account found' }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const portalSession = await stripeAdmin.billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: `${baseUrl}/dashboard?tab=billing`,
  });

  return Response.json({ url: portalSession.url });
}
