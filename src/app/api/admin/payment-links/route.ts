import { NextRequest } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { stripeAdmin } from '@/libs/stripe/stripe-admin';

async function assertAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: session.user.id } as any);
  return isAdmin ? session : null;
}

export async function POST(req: NextRequest) {
  const session = await assertAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, stripePriceIds, note } = await req.json();
  if (!userId || !Array.isArray(stripePriceIds) || stripePriceIds.length === 0) {
    return Response.json({ error: 'userId and stripePriceIds (array) are required' }, { status: 400 });
  }

  // Validate all prices exist in Stripe
  if (!stripeAdmin) return Response.json({ error: 'Stripe not configured' }, { status: 500 });
  try {
    await Promise.all(stripePriceIds.map((id: string) => stripeAdmin!.prices.retrieve(id)));
  } catch {
    return Response.json({ error: 'One or more invalid Stripe price IDs' }, { status: 400 });
  }

  const { data, error } = await supabaseAdminClient
    .from('payment_links' as any)
    .insert({
      user_id: userId,
      stripe_price_id: stripePriceIds[0],
      stripe_price_ids: stripePriceIds,
      note: note ?? null,
    })
    .select('token')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Record timestamp
  await supabaseAdminClient
    .from('aa_demo_businesses')
    .update({ payment_link_sent_at: new Date().toISOString() } as any)
    .eq('user_id', userId);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return Response.json({ url: `${baseUrl}/pay/${(data as any).token}` });
}

export async function GET(req: NextRequest) {
  const session = await assertAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const userId = req.nextUrl.searchParams.get('userId');
  const query = supabaseAdminClient
    .from('payment_links' as any)
    .select('*')
    .order('created_at', { ascending: false });

  if (userId) query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
