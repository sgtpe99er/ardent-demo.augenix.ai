import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { getSession } from '@/features/account/controllers/get-session';
import type { Tables } from '@/libs/supabase/types';

type EditRequest = Tables<'aa_demo_edit_requests'>;
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
      .from('aa_demo_edit_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply status filter if provided
    if (status) {
      query = query.in('status', status.split(',') as any);
    }

    // Get total count
    const { count } = await supabase
      .from('aa_demo_edit_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', (status ? status.split(',') : ['pending', 'in_progress', 'completed', 'failed']) as any);

    // Fetch paginated data
    const { data: editRequests, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Fetch businesses for names
    const { data: businesses } = await supabase
      .from('aa_demo_businesses')
      .select('user_id, business_name');

    const bizByUserId = Object.fromEntries(
      (businesses ?? []).map((b) => [b.user_id, b.business_name])
    );

    // Attach business names
    const editRequestsWithBusiness = (editRequests ?? []).map((er: EditRequest) => ({
      ...er,
      businessName: bizByUserId[er.user_id] ?? 'Unknown',
    }));

    return NextResponse.json({
      editRequests: editRequestsWithBusiness,
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
    console.error('Error fetching admin edit requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
