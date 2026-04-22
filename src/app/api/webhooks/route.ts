import Stripe from 'stripe';

import { upsertUserSubscription } from '@/features/account/controllers/upsert-user-subscription';
import { upsertPrice } from '@/features/pricing/controllers/upsert-price';
import { upsertProduct } from '@/features/pricing/controllers/upsert-product';
import { stripeAdmin } from '@/libs/stripe/stripe-admin';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { generateAssets } from '@/libs/ai/asset-generator';
import { sendPaymentConfirmedWithLink } from '@/features/emails/send-payment-confirmed-with-link';
import { purchaseDomain } from '@/libs/vercel/purchase-domain';

const relevantEvents = new Set([
  'product.created',
  'product.updated',
  'price.created',
  'price.updated',
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

export async function POST(req: Request) {
  // Return early if Stripe is not configured
  if (!stripeAdmin) {
    return Response.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }
    event = stripeAdmin.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (error) {
    return Response.json(`Webhook Error: ${(error as any).message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case 'product.created':
        case 'product.updated':
          await upsertProduct(event.data.object as Stripe.Product);
          break;
        case 'price.created':
        case 'price.updated':
          await upsertPrice(event.data.object as Stripe.Price);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          await upsertUserSubscription({
            subscriptionId: subscription.id,
            customerId: subscription.customer as string,
            isCreateAction: false,
          });
          break;
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;

          if (checkoutSession.mode === 'subscription') {
            const subscriptionId = checkoutSession.subscription;
            await upsertUserSubscription({
              subscriptionId: subscriptionId as string,
              customerId: checkoutSession.customer as string,
              isCreateAction: true,
            });
            // Also trigger asset generation on first subscription payment
            await handleHostingPayment(checkoutSession);
          } else if (checkoutSession.mode === 'payment') {
            // One-time hosting payment (lifetime deal) — trigger asset generation
            await handleHostingPayment(checkoutSession);
          }
          break;
        default:
          throw new Error('Unhandled relevant event!');
      }
    } catch (error) {
      console.error(error);
      return Response.json('Webhook handler failed. View your nextjs function logs.', {
        status: 400,
      });
    }
  }
  return Response.json({ received: true });
}

// Maps Stripe price IDs to hosting months
const PRICE_HOSTING_MONTHS: Record<string, number> = {
  [process.env.STRIPE_PRICE_1MO ?? '']: 1,
  [process.env.STRIPE_PRICE_6MO ?? '']: 6,
  [process.env.STRIPE_PRICE_12MO ?? '']: 12,
  [process.env.STRIPE_PRICE_LIFETIME ?? '']: 1200,
};

async function resolveHostingMonths(session: Stripe.Checkout.Session): Promise<number> {
  // For subscriptions, look up the price ID from the subscription
  if (session.mode === 'subscription' && session.subscription && stripeAdmin) {
    const sub = await stripeAdmin.subscriptions.retrieve(session.subscription as string);
    const priceId = sub.items.data[0]?.price?.id ?? '';
    return PRICE_HOSTING_MONTHS[priceId] ?? 1;
  }
  // For one-time payments, use metadata
  return session.metadata?.hosting_months ? parseInt(session.metadata.hosting_months) : 1200;
}

async function handleHostingPayment(session: Stripe.Checkout.Session) {
  const db = supabaseAdminClient;

  // Resolve userId from Stripe customer → customers table
  const { data: customerRow } = await db
    .from('aa_demo_customers')
    .select('id')
    .eq('stripe_customer_id', session.customer as string)
    .single();

  if (!customerRow) {
    console.error('handleHostingPayment: no customer row for', session.customer);
    return;
  }

  const userId = customerRow.id;
  const hostingMonths = await resolveHostingMonths(session);

  // Record the hosting payment
  await db.from('hosting_payments' as any).insert({
    user_id: userId,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: (session.payment_intent as string) ?? null,
    amount: (session.amount_subtotal ?? 0) / 100,
    total_amount: (session.amount_total ?? 0) / 100,
    hosting_months: hostingMonths,
    status: 'paid',
    paid_at: new Date().toISOString(),
  });

  // Determine subscription plan label from hosting months
  const subscriptionPlan =
    hostingMonths === 1 ? 'monthly' :
    hostingMonths === 6 ? '6_month' :
    hostingMonths === 12 ? 'annual' :
    'lifetime';

  // Update business status + payment fields
  await db
    .from('aa_demo_businesses')
    .update({
      status: 'assets_generating',
      payment_status: 'paid',
      subscription_plan: subscriptionPlan,
      amount_paid: (session.amount_total ?? 0) / 100,
      payment_paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('user_id', userId);

  // Fetch business + brand_assets for generation input
  const { data: business } = await db
    .from('aa_demo_businesses')
    .select('id, business_name, industry, target_audience, services_products')
    .eq('user_id', userId)
    .single();

  const { data: brandAssets } = await db
    .from('aa_demo_brand_assets')
    .select('has_existing_logo, existing_logo_url, has_brand_colors, brand_colors, style_preference, color_preference, existing_website_url')
    .eq('user_id', userId)
    .maybeSingle();

  if (!business) {
    console.error('handleHostingPayment: no business found for user', userId);
    return;
  }

  // Mark payment link as used if token present in metadata
  const paymentLinkToken = session.metadata?.payment_link_token;
  if (paymentLinkToken) {
    await db
      .from('payment_links' as any)
      .update({ used: true })
      .eq('token', paymentLinkToken);
  }

  // Send payment confirmation email with magic link to dashboard (fire-and-forget)
  const { data: authUser } = await supabaseAdminClient.auth.admin.getUserById(userId);
  if (authUser?.user?.email) {
    sendPaymentConfirmedWithLink({
      userId,
      userEmail: authUser.user.email,
      businessName: (business as any).business_name ?? '',
      amount: (session.amount_total ?? 0) / 100,
    }).catch((err: Error) => console.error('sendPaymentConfirmedWithLink failed:', err));
  }

  // Trigger domain purchase if one was selected at checkout
  const pendingDomain = session.metadata?.pending_domain;
  const domainVercelPriceCents = session.metadata?.domain_vercel_price_cents;
  if (pendingDomain && domainVercelPriceCents && business) {
    // Fetch the Vercel project ID if the site has been provisioned
    const { data: deployedSite } = await db
      .from('aa_demo_deployed_websites')
      .select('vercel_project_id')
      .eq('customer_id', userId)
      .maybeSingle();

    purchaseDomain({
      userId,
      businessId: (business as any).id,
      domain: pendingDomain,
      vercelPriceCents: parseInt(domainVercelPriceCents, 10),
      vercelProjectId: (deployedSite as any)?.vercel_project_id ?? null,
    }).catch((err) => console.error('purchaseDomain failed in webhook:', err));
  }

  // Fire-and-forget — do not await so webhook returns quickly
  generateAssets({
    userId,
    businessId: (business as any).id,
    businessName: (business as any).business_name ?? '',
    industry: (business as any).industry ?? '',
    targetAudience: (business as any).target_audience ?? '',
    servicesProducts: (business as any).services_products ?? '',
    stylePreference: (brandAssets as any)?.style_preference ?? 'modern',
    colorPreference: (brandAssets as any)?.color_preference ?? '',
    hasExistingLogo: (brandAssets as any)?.has_existing_logo ?? false,
    existingLogoUrl: (brandAssets as any)?.existing_logo_url ?? undefined,
    hasBrandColors: (brandAssets as any)?.has_brand_colors ?? false,
    brandColors: (brandAssets as any)?.brand_colors ?? undefined,
    existingWebsiteUrl: (brandAssets as any)?.existing_website_url ?? undefined,
  }).catch((err) => console.error('generateAssets failed:', err));
}
