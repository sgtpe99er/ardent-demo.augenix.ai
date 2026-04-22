import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId } = await params;

  // Verify user owns the business
  const { data: business } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('id')
    .eq('id', businessId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  // Return the most recent selection for this business
  const { data: selection, error } = await supabaseAdminClient
    .from('design_selections' as any)
    .select(`
      id,
      selected_at,
      notes,
      variant_id
    `)
    .eq('business_id', businessId)
    .eq('user_id', session.user.id)
    .order('selected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[preview/selection GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ selection });
}
