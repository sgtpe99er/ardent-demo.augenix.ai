import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
) {
  try {
    const { sessionId, itemId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['confirmed', 'declined'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseAdminClient
      .from('aa_demo_admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Verify session - admins can access any session
    let query = supabaseAdminClient
      .from('onboarding_discovery_sessions')
      .select('id')
      .eq('id', sessionId);

    if (!adminUser) {
      query = query.eq('user_id', user.id);
    }

    const { data: session } = await query.single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update item status
    const { error: updateError } = await supabaseAdminClient
      .from('onboarding_discovery_items')
      .update({ status })
      .eq('id', itemId)
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('Failed to update item:', updateError);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
