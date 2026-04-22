import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

const VALID_CATEGORIES = ['design', 'content', 'layout', 'other'] as const;
const VALID_STATUSES = ['new', 'acknowledged', 'resolved'] as const;

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'freewebsite.deal';

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin') ?? '';
  const allowed = origin.endsWith('.' + ROOT_DOMAIN) || origin === 'https://' + ROOT_DOMAIN;
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });

  const { businessId } = await params;

  // Verify user owns the business
  const { data: business } = await supabaseAdminClient
    .from('aa_demo_businesses')
    .select('id')
    .eq('id', businessId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404, headers: corsHeaders(req) });
  }

  const body = await req.json() as {
    variantId?: string;
    feedbackText: string;
    category?: string;
  };

  const { variantId, feedbackText, category = 'other' } = body;

  if (!feedbackText?.trim()) {
    return NextResponse.json({ error: 'feedbackText is required' }, { status: 400, headers: corsHeaders(req) });
  }

  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400, headers: corsHeaders(req) },
    );
  }

  const { error } = await supabaseAdminClient
    .from('preview_feedback' as any)
    .insert({
      business_id: businessId,
      user_id: session.user.id,
      variant_id: variantId ?? null,
      feedback_text: feedbackText.trim(),
      category,
      status: 'new',
    } as never);

  if (error) {
    console.error('[preview/feedback POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: corsHeaders(req) });
}

export async function GET(
  req: NextRequest,
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

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');

  let query = supabaseAdminClient
    .from('preview_feedback' as any)
    .select('id, variant_id, feedback_text, category, status, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (statusFilter && VALID_STATUSES.includes(statusFilter as typeof VALID_STATUSES[number])) {
    query = query.eq('status', statusFilter);
  }

  const { data: feedback, error } = await query;

  if (error) {
    console.error('[preview/feedback GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback });
}
