import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { syncProspectToCrm } from '@/libs/crm/sync-prospect';

function verifyAgentApiKey(request: NextRequest): boolean {
  const key = process.env.FREEWEBSITE_AGENT_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

function generateSubdomain(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `site-${suffix}`;
}

export async function POST(request: NextRequest) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, businessName } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  // Prospect users get placeholder emails in the @prospect.freewebsite.deal domain.
  const isProspect = email.toLowerCase().endsWith('@prospect.freewebsite.deal');

  // Check if user already exists with this email — return existing user (idempotent)
  const { data: { users: matchedUsers } } = await supabaseAdminClient.auth.admin.listUsers({
    filter: email.toLowerCase(),
    page: 1,
    perPage: 1,
  } as any);
  const existingUser = matchedUsers?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    // Fetch their business and deployed_websites to return full data
    let { data: business } = await supabaseAdminClient
      .from('aa_demo_businesses')
      .select('id, business_name')
      .eq('user_id', existingUser.id)
      .single();

    let { data: website } = await supabaseAdminClient
      .from('deployed_websites' as any)
      .select('subdomain')
      .eq('user_id', existingUser.id)
      .single();

    // Auth user exists but CRM records are missing — recover from partial creation failure
    if (!business) {
      const { data: newBusiness } = await supabaseAdminClient
        .from('aa_demo_businesses')
        .insert({
          user_id: existingUser.id,
          business_name: businessName || null,
          status: 'onboarding',
        } as any)
        .select('id, business_name')
        .single();
      business = newBusiness;
    }

    if (!website) {
      const newSubdomain = generateSubdomain(businessName || email);
      await supabaseAdminClient.from('deployed_websites' as any).insert({
        user_id: existingUser.id,
        subdomain: newSubdomain,
        status: 'building',
        approval_status: 'pending',
      });
      website = { subdomain: newSubdomain } as any;
    }

    const subdomain = (website as any)?.subdomain ?? null;

    if (isProspect && businessName) {
      await syncProspectToCrm(existingUser.id, businessName);
    }

    return NextResponse.json({
      userId: existingUser.id,
      email: existingUser.email,
      businessId: business?.id ?? null,
      subdomain,
      siteUrl: subdomain ? `https://${subdomain}.freewebsite.deal` : null,
      dashboardUrl: `https://freewebsite.deal/dashboard`,
      created: false,
    });
  }

  // Create new auth user (no password — magic link only)
  const { data: newUser, error: createError } =
    await supabaseAdminClient.auth.admin.createUser({
      email,
      email_confirm: true,
    });

  if (createError || !newUser.user) {
    return NextResponse.json(
      { error: createError?.message ?? 'Failed to create user' },
      { status: 500 }
    );
  }

  const userId = newUser.user.id;

  // Create business record
  const { data: business, error: bizError } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .insert({
      user_id: userId,
      business_name: businessName || null,
      status: 'onboarding',
    } as any)
    .select('id')
    .single();

  if (bizError) {
    console.error('Failed to create business:', bizError);
  }

  // Create deployed_websites row with generated subdomain
  const subdomain = generateSubdomain(businessName || email);
  await supabaseAdminClient.from('deployed_websites' as any).insert({
    user_id: userId,
    subdomain,
    status: 'building',
    approval_status: 'pending',
  });

  if (isProspect && businessName) {
    await syncProspectToCrm(userId, businessName);
  }

  return NextResponse.json({
    userId,
    email,
    businessId: business?.id ?? null,
    subdomain,
    siteUrl: `https://${subdomain}.freewebsite.deal`,
    dashboardUrl: `https://freewebsite.deal/dashboard`,
    created: true,
  });
}
