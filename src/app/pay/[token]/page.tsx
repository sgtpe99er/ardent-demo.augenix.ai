import { notFound } from 'next/navigation';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { stripeAdmin } from '@/libs/stripe/stripe-admin';
import { PaymentPage } from './payment-page';

export default async function PayTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Resolve link
  const { data: link } = await supabaseAdminClient
    .from('payment_links' as any)
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .single();

  if (!link) notFound();

  const l = link as any;
  if (new Date(l.expires_at) < new Date()) notFound();

  // Fetch user info
  const { data: authUser } = await supabaseAdminClient.auth.admin.getUserById(l.user_id);
  const email = authUser?.user?.email ?? '';

  // Fetch business name if available
  const { data: business } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('business_name')
    .eq('user_id', l.user_id)
    .maybeSingle();

  if (!stripeAdmin) notFound();

  // Determine which price IDs to show (multi-price or legacy single)
  const priceIds: string[] = Array.isArray(l.stripe_price_ids) && l.stripe_price_ids.length > 0
    ? l.stripe_price_ids
    : [l.stripe_price_id];

  // Fetch all prices + products from Stripe
  const prices = await Promise.all(
    priceIds.map((id: string) => stripeAdmin!.prices.retrieve(id, { expand: ['product'] }))
  );

  const priceOptions = prices.map((p) => {
    const prod = p.product as { name: string; description: string | null } | null;
    return {
      id: p.id,
      unitAmount: p.unit_amount ?? 0,
      currency: p.currency,
      type: p.type,
      interval: p.recurring?.interval ?? null,
      productName: prod?.name ?? 'Website Package',
      productDescription: prod?.description ?? null,
    };
  });

  return (
    <PaymentPage
      token={token}
      email={email}
      businessName={(business as any)?.business_name ?? null}
      note={l.note ?? null}
      prices={priceOptions}
      oneMoId={process.env.STRIPE_PRICE_1MO}
      sixMoId={process.env.STRIPE_PRICE_6MO}
      twelveId={process.env.STRIPE_PRICE_12MO}
    />
  );
}
