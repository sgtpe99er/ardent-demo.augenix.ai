import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseAdminClient
      .from('aa_demo_admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Get session - admins can access any session, regular users only their own
    let query = supabaseAdminClient
      .from('onboarding_discovery_sessions')
      .select('*')
      .eq('id', sessionId);

    if (!adminUser) {
      // Not an admin - restrict to own sessions
      query = query.eq('user_id', user.id);
    }

    const { data: session, error: sessionError } = await query.single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get items
    const { data: items, error: itemsError } = await supabaseAdminClient
      .from('onboarding_discovery_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Failed to fetch items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    return NextResponse.json({
      status: session.status,
      items: items || [],
    });
  } catch (error) {
    console.error('Get discovery session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
