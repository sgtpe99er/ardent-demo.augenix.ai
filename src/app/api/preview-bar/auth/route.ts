import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'freewebsite.deal';

function getCorsHeaders(subdomain: string | null): HeadersInit {
  const origin = subdomain ? `https://${subdomain}.${ROOT_DOMAIN}` : '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subdomain = searchParams.get('subdomain');
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(subdomain) });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subdomain = searchParams.get('subdomain');
  const corsHeaders = getCorsHeaders(subdomain);

  if (!subdomain) {
    return NextResponse.json({ error: 'subdomain is required' }, { status: 400, headers: corsHeaders });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  // Look up deployed website by slug
  const { data: website } = await supabaseAdminClient
    .from('deployed_websites' as any)
    .select('id, business_id, approval_status')
    .eq('subdomain', subdomain)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string; business_id: string; approval_status: string | null } | null };

  if (!website) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404, headers: corsHeaders });
  }

  // Check if user is admin (admins can see any site's bar)
  const { data: isAdmin } = await supabaseAdminClient.rpc('is_admin', { user_uuid: session.user.id } as any);

  if (!isAdmin) {
    // Verify the authenticated user owns this business
    const { data: business } = await supabaseAdminClient
      .from('aa_demo_businesses')
      .select('id')
      .eq('id', website.business_id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
  }

  // Fetch design variants for this site
  const { data: variants } = await supabaseAdminClient
    .from('design_variants' as any)
    .select('id, variant_number, label, vercel_deployment_url, thumbnail_url, status')
    .eq('business_id', website.business_id)
    .neq('status', 'archived')
    .order('variant_number', { ascending: true }) as { data: Array<{
      id: string;
      variant_number: number;
      label: string;
      vercel_deployment_url: string | null;
      thumbnail_url: string | null;
      status: string;
    }> | null };

  return NextResponse.json(
    {
      businessId: website.business_id,
      approvalStatus: website.approval_status ?? null,
      variants: variants ?? [],
    },
    { status: 200, headers: corsHeaders },
  );
}
