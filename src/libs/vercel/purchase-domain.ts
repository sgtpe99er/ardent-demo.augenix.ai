import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { buyDomain, getDomainPrice, type DomainRegistrantContact } from '@/libs/vercel/domains';
import { addDomain } from '@/libs/vercel/client';

interface PurchaseDomainInput {
  userId: string;
  businessId: string;
  domain: string;
  /** Vercel's raw purchase price in cents (stored in Stripe session metadata) */
  vercelPriceCents: number;
  /** Vercel project ID to attach the domain to (optional — attach later if not yet provisioned) */
  vercelProjectId?: string | null;
}

/**
 * Purchases a domain via Vercel Registrar and attaches it to the customer's Vercel project.
 * Called from the Stripe webhook after checkout.session.completed.
 */
export async function purchaseDomain({
  userId,
  businessId,
  domain,
  vercelPriceCents,
  vercelProjectId,
}: PurchaseDomainInput): Promise<void> {
  const db = supabaseAdminClient;

  // Mark as purchasing
  await db
    .from('aa_demo_businesses')
    .update({ domain_status: 'purchasing', updated_at: new Date().toISOString() } as any)
    .eq('id', businessId);

  try {
    // Re-fetch current price to guard against price changes between checkout and purchase
    const currentPrice = await getDomainPrice(domain);
    const currentPriceCents = Math.round(currentPrice.purchasePrice * 100);

    // Allow up to $2 drift
    if (Math.abs(currentPriceCents - vercelPriceCents) > 200) {
      throw new Error(
        `Domain price changed: expected ${vercelPriceCents}¢, got ${currentPriceCents}¢`,
      );
    }

    // Load registrant contact from the customer's business record
    const { data: bizRow } = await db
      .from('aa_demo_businesses')
      .select('domain_registrant_contact')
      .eq('id', businessId)
      .single();

    const contact = (bizRow as any)?.domain_registrant_contact as DomainRegistrantContact | null;
    if (!contact?.firstName || !contact?.email) {
      throw new Error('Domain registrant contact info is missing — customer must complete onboarding step 4.');
    }

    const order = await buyDomain(domain, currentPrice.purchasePrice, contact);

    // Attach to Vercel project if already provisioned
    if (vercelProjectId) {
      try {
        await addDomain(vercelProjectId, domain);
      } catch (err) {
        // Non-fatal — admin can attach manually
        console.error(`purchaseDomain: addDomain to project ${vercelProjectId} failed:`, err);
      }
    }

    // Update DB: domain active
    await db
      .from('aa_demo_businesses')
      .update({
        domain_name: domain,
        domain_status: 'active',
        vercel_order_id: order.orderId,
        domain_registered_at: new Date().toISOString(),
        domain_renewal_price_usd: currentPrice.renewalPrice,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', businessId);
  } catch (err) {
    console.error('purchaseDomain failed:', err);

    await db
      .from('aa_demo_businesses')
      .update({ domain_status: 'failed', updated_at: new Date().toISOString() } as any)
      .eq('id', businessId);

    // Re-throw so the caller can alert admin
    throw err;
  }
}
