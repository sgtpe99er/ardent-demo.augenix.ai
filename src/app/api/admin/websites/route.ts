import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';
import type { Tables } from '@/libs/supabase/types';

type DeployedWebsite = Tables<'aa_demo_deployed_websites'>;
type Business = Tables<'aa_demo_businesses'>;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    
    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin', {
      user_uuid: session.user.id,
    } as any);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('aa_demo_deployed_websites')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status) {
      query = query.in('status', status.split(',') as any);
    }

    // Get total count
    const { count } = await supabase
      .from('aa_demo_deployed_websites')
      .select('*', { count: 'exact', head: true })
      .in('status', (status ? status.split(',') : ['provisioning', 'building', 'built', 'deployed', 'failed']) as any);

    // Fetch paginated data
    const { data: websites, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Fetch related data in parallel
    const [
      { data: businesses },
      { data: authUsers }
    ] = await Promise.all([
      supabase.from('aa_demo_businesses').select('*'),
      supabaseAdminClient.auth.admin.listUsers()
    ]);

    const emailMap = Object.fromEntries(
      (authUsers?.users ?? []).map((u) => [u.id, u.email ?? ''])
    );

    // Attach business names and emails
    const bizList = (businesses ?? []) as any[];
    const websitesWithDetails = (websites ?? []).map((w: any) => ({
      ...w,
      businessName: bizList.find((b) => b.user_id === w.user_id)?.business_name ?? 'Unknown',
      userEmail: emailMap[w.user_id] ?? '',
    }));

    return NextResponse.json({
      websites: websitesWithDetails,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
        hasNext: offset + limit < (count ?? 0),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching admin websites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
