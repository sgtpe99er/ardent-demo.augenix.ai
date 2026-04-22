import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { mergePullRequest } from '@/libs/github/client';
import type { Database } from '@/libs/supabase/types';

async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: user.id } as any);
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return { userId: user.id };
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as {
    website_id: string;
    pr_number: number;
  };

  const { website_id, pr_number } = body;

  if (!website_id || !pr_number) {
    return NextResponse.json(
      { error: 'website_id and pr_number are required' },
      { status: 400 },
    );
  }

  // Fetch the website record to get the repo name
  const { data: website, error: fetchError } = await supabaseAdmin
    .from('aa_demo_deployed_websites')
    .select('github_repo_name, vercel_project_id')
    .eq('id', website_id)
    .single();

  if (fetchError || !website) {
    return NextResponse.json({ error: 'Website not found' }, { status: 404 });
  }

  if (!website.github_repo_name) {
    return NextResponse.json(
      { error: 'Website has no linked GitHub repo' },
      { status: 400 },
    );
  }

  try {
    // Merge the PR — Vercel will auto-deploy on the push to main
    await mergePullRequest(website.github_repo_name, pr_number);

    // Mark as pending_changes → Vercel webhook will flip to 'deployed' on success
    await supabaseAdmin
      .from('aa_demo_deployed_websites')
      .update({
        status: 'pending_changes',
        approval_status: 'approved',
      })
      .eq('id', website_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[approve-changes] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
