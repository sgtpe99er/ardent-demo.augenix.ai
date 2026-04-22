import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';

async function assertAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: session.user.id } as any);
  return isAdmin ? session : null;
}

// GET /api/admin/crm — list prospects with filtering & pagination
export async function GET(request: NextRequest) {
  try {
    const session = await assertAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const search = searchParams.get('search') ?? '';
    const stage = searchParams.get('stage') ?? '';
    const state = searchParams.get('state') ?? '';
    const offset = (page - 1) * limit;

    let query = supabaseAdminClient
      .from('crm_prospects' as any)
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(
        `business_name.ilike.%${search}%,owner_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,city.ilike.%${search}%`
      );
    }
    if (stage) query = query.eq('prospect_stage', stage);
    if (state) query = query.eq('state', state);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const total = count ?? 0;
    return NextResponse.json({
      prospects: data ?? [],
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
    console.error('CRM GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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

// Create a placeholder prospect user and link them to the CRM entry.
async function createUserForProspect(
  prospectId: string,
  businessName: string
): Promise<string | null> {
  try {
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40)
      .replace(/^-+|-+$/g, '');
    const suffix = Math.random().toString(36).slice(2, 6);
    const email = `${slug || 'prospect'}-${suffix}@prospect.freewebsite.deal`;

    const { data: newUser, error: createError } =
      await supabaseAdminClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

    if (createError || !newUser.user) {
      console.error('Failed to create prospect user:', createError);
      return null;
    }

    const userId = newUser.user.id;

    // Create business and deployed_websites records
    await supabaseAdminClient.from('aa_demo_businesses').insert({
      user_id: userId,
      business_name: businessName,
      status: 'onboarding',
    } as any);

    const subdomain = generateSubdomain(businessName);
    await supabaseAdminClient.from('deployed_websites' as any).insert({
      user_id: userId,
      subdomain,
      status: 'building',
      approval_status: 'pending',
    });

    // Link fwd_user_id back on the CRM entry
    await supabaseAdminClient
      .from('crm_prospects' as any)
      .update({ fwd_user_id: userId })
      .eq('id', prospectId);

    return userId;
  } catch (err) {
    console.error('createUserForProspect failed:', err);
    return null;
  }
}

// POST /api/admin/crm — create a new prospect
export async function POST(request: NextRequest) {
  try {
    const session = await assertAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();

    // Generate a prospect ID if not provided
    if (!body.id) {
      const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
      body.id = `PRO-${hex}`;
    }

    const { data, error } = await supabaseAdminClient
      .from('crm_prospects' as any)
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ prospect: data }, { status: 201 });
  } catch (error) {
    console.error('CRM POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
