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

  const { data: variants, error } = await supabaseAdminClient
    .from('design_variants' as any)
    .select('id, variant_number, label, vercel_deployment_url, thumbnail_url, status, created_at')
    .eq('business_id', businessId)
    .neq('status', 'archived')
    .order('variant_number', { ascending: true });

  if (error) {
    console.error('[preview/variants GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ variants });
}
