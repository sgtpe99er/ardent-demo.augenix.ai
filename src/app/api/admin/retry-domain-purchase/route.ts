import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { purchaseDomain } from '@/libs/vercel/purchase-domain';
import { getDomainPrice } from '@/libs/vercel/domains';
import { getSession } from '@/features/account/controllers/get-session';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', {
    user_uuid: session.user.id,
  } as any);
  return isAdmin ? session : null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { businessId } = await request.json();
    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
    }

    // Get business data
    const { data: businessData } = await supabaseAdminClient
      .from('aa_demo_businesses')
      .select('id, user_id, domain_name, domain_status')
      .eq('id', businessId)
      .single();

    const business = businessData as any;

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.domain_status !== 'failed' && business.domain_status !== 'purchasing') {
      return NextResponse.json(
        { error: `Cannot retry purchase. Current status is: ${business.domain_status}` },
        { status: 400 }
      );
    }

    if (!business.domain_name) {
      return NextResponse.json({ error: 'No domain name associated with this business' }, { status: 400 });
    }

    // Get Vercel project ID if deployed
    const { data: deployedSite } = await supabaseAdminClient
      .from('aa_demo_deployed_websites')
      .select('vercel_project_id')
      .eq('user_id', business.user_id)
      .maybeSingle();

    // Get current domain price to pass to purchaseDomain
    // We fetch it live so purchaseDomain's internal verification passes against the latest price
    const currentPrice = await getDomainPrice(business.domain_name);
    const vercelPriceCents = Math.round(currentPrice.purchasePrice * 100);

    // Call purchaseDomain
    await purchaseDomain({
      userId: business.user_id,
      businessId: business.id,
      domain: business.domain_name,
      vercelPriceCents: vercelPriceCents,
      vercelProjectId: (deployedSite as any)?.vercel_project_id ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to retry domain purchase:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
