import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';
import { sendWelcomeEmail } from '@/features/emails/send-welcome';
import type { Tables } from '@/libs/supabase/types';

type Business = Tables<'aa_demo_businesses'>;

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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', {
    user_uuid: session.user.id,
  } as any);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    email,
    password,
    role, // 'user' | 'admin'
    // Business fields
    businessName,
    industry,
    locationCity,
    locationState,
    locationCountry,
    targetAudience,
    servicesProducts,
    websiteFeatures,
    status,
    sendWelcomeEmail: shouldSendWelcomeEmail = true,
  } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  // Create auth user via admin API
  const { data: newUser, error: createError } = await supabaseAdminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 400 });
  }

  const userId = newUser.user.id;

  // If admin role, insert into admin_users table
  if (role === 'admin') {
    await supabaseAdminClient.from('aa_demo_admin_users').insert({
      user_id: userId,
    } as any);
  }

  // Create business record if any business data provided
  if (businessName || industry || locationCity) {
    await supabaseAdminClient.from('aa_demo_businesses').insert({
      user_id: userId,
      business_name: businessName || null,
      industry: industry || null,
      location_city: locationCity || null,
      location_state: locationState || null,
      location_country: locationCountry || null,
      target_audience: targetAudience || null,
      services_products: servicesProducts || null,
      website_features: websiteFeatures?.length ? websiteFeatures : null,
      status: status || 'onboarding',
    } as any);
  }

  // Auto-create deployed_websites row with a generated subdomain
  const subdomain = generateSubdomain(businessName || email);
  await supabaseAdminClient.from('deployed_websites' as any).insert({
    user_id: userId,
    subdomain,
    status: 'building',
    approval_status: 'pending',
  });

  // Send welcome email (fire-and-forget, optional)
  const isProspect = email.toLowerCase().endsWith('@prospect.freewebsite.deal');
  if (shouldSendWelcomeEmail && !isProspect) {
    sendWelcomeEmail({ userEmail: email, businessName: businessName || undefined }).catch((err) =>
      console.error('sendWelcomeEmail failed:', err)
    );
  }

  return NextResponse.json({ success: true, userId });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    const { data: isAdmin } = await supabase.rpc('is_admin', {
      user_uuid: session.user.id,
    } as any);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const search = searchParams.get('search') ?? '';
    // type filter: 'all' | 'users' | 'prospects'
    const typeFilter = searchParams.get('type') ?? 'all';
    const offset = (page - 1) * limit;

    // Fetch all auth users directly (always fresh, no stale cache)
    const [
      { data: authData },
      { data: businesses },
      { data: adminUsers },
    ] = await Promise.all([
      supabaseAdminClient.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from('aa_demo_businesses').select('*'),
      supabase.from('aa_demo_admin_users').select('user_id'),
    ]);

    const adminUserIds = (adminUsers ?? []).map((a: any) => a.user_id as string);
    const bizByUserId = Object.fromEntries((businesses ?? []).map((b: Business) => [b.user_id, b]));

    let customers = ((authData as any)?.users ?? []).map((u: any) => {
      const biz = bizByUserId[u.id];
      const is_prospect = (u.email ?? '').toLowerCase().endsWith('@prospect.freewebsite.deal');
      return {
        user_id: u.id,
        email: u.email ?? '',
        created_at: u.created_at,
        business_id: biz?.id ?? null,
        business_name: biz?.business_name ?? null,
        industry: biz?.industry ?? null,
        location_city: biz?.location_city ?? null,
        location_state: biz?.location_state ?? null,
        location_country: biz?.location_country ?? null,
        target_audience: biz?.target_audience ?? null,
        services_products: biz?.services_products ?? null,
        website_features: biz?.website_features ?? null,
        status: biz?.status ?? 'no_business',
        is_prospect,
        payment_status: (biz as any)?.payment_status ?? null,
        subscription_plan: (biz as any)?.subscription_plan ?? null,
        amount_paid: (biz as any)?.amount_paid ?? null,
        payment_paid_at: (biz as any)?.payment_paid_at ?? null,
      };
    });

    // Apply type filter
    if (typeFilter === 'prospects') {
      customers = customers.filter((c: any) => c.is_prospect);
    } else if (typeFilter === 'users') {
      customers = customers.filter((c: any) => !c.is_prospect);
    }

    // Apply search filter
    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter((c: any) =>
        (c.business_name ?? '').toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }

    customers.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = customers.length;
    const paginatedCustomers = customers.slice(offset, offset + limit);

    return NextResponse.json({
      customers: paginatedCustomers,
      adminUserIds,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
