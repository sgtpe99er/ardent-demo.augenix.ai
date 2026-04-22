import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

const schema = z.object({
  business_name: z.string().min(1).max(100),
  industry: z.string().optional(),
  location_city: z.string().optional(),
  location_state: z.string().optional(),
  location_country: z.string().optional(),
  target_audience: z.string().optional(),
  services_products: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid data' }, { status: 400 });
  }

  const db = supabaseAdminClient as any;
  const { error } = await db
    .from('aa_demo_businesses')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('user_id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
