import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/account/controllers/get-session';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getRepoFile, upsertRepoFile } from '@/libs/github/client';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'freewebsite.deal';

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin') ?? '';
  const allowed = origin.endsWith('.' + ROOT_DOMAIN) || origin === 'https://' + ROOT_DOMAIN;
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const body = await req.json() as { variantId: string; notes?: string };
  const { variantId, notes } = body;

  if (!variantId) {
    return NextResponse.json({ error: 'variantId is required' }, { status: 400 });
  }

  // Fetch the variant — need variant_number to derive the design file path
  const { data: variant } = await supabaseAdminClient
    .from('design_variants' as any)
    .select('id, variant_number, deployed_website_id, status')
    .eq('id', variantId)
    .eq('business_id', businessId)
    .maybeSingle() as { data: { id: string; variant_number: number; deployed_website_id: string | null; status: string } | null };

  if (!variant) {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
  }

  // Fetch the deployed website for repo info
  const { data: website } = await supabaseAdminClient
    .from('aa_demo_deployed_websites')
    .select('id, github_repo_name')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!website?.github_repo_name) {
    return NextResponse.json({ error: 'No linked GitHub repo found for this business' }, { status: 400 });
  }

  // Record the selection
  const { error: selectionError } = await supabaseAdminClient
    .from('design_selections' as any)
    .insert({
      business_id: businessId,
      user_id: session.user.id,
      variant_id: variantId,
      notes: notes ?? null,
    } as never);

  if (selectionError) {
    console.error('[preview/select POST] insert selection failed:', selectionError);
    return NextResponse.json({ error: selectionError.message }, { status: 500 });
  }

  // Mark this variant as selected, clear any previous selection for this business
  await supabaseAdminClient
    .from('design_variants' as any)
    .update({ selected: false } as never)
    .eq('business_id', businessId);

  await supabaseAdminClient
    .from('design_variants' as any)
    .update({ selected: true } as never)
    .eq('id', variantId);

  // Mark the website as approved
  await supabaseAdminClient
    .from('aa_demo_deployed_websites')
    .update({
      approval_status: 'approved',
      status: 'pending_changes',
      updated_at: new Date().toISOString(),
    })
    .eq('id', website.id);

  // Copy the selected design-N/page.tsx to src/app/page.tsx on main
  try {
    const designPath = `src/app/design-${variant.variant_number}/page.tsx`;
    const { content: designContent } = await getRepoFile(website.github_repo_name, designPath);

    // Get current SHA of root page.tsx so we can update it in place
    let rootPageSha: string | undefined;
    try {
      const rootPage = await getRepoFile(website.github_repo_name, 'src/app/page.tsx');
      rootPageSha = rootPage.sha;
    } catch {
      // File may not exist yet — upsertRepoFile handles creation without a SHA
    }

    await upsertRepoFile(
      website.github_repo_name,
      'src/app/page.tsx',
      designContent,
      `feat: apply selected design (variant ${variant.variant_number})`,
      'main',
      rootPageSha,
    );
  } catch (copyErr) {
    const message = copyErr instanceof Error ? copyErr.message : String(copyErr);
    console.error('[preview/select] file copy failed:', message);
    // Non-fatal — selection is recorded; Vercel will redeploy once resolved
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: corsHeaders(req) });
}
