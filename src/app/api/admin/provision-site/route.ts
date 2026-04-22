import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createRepoFromTemplate, getRepoFile, upsertRepoFile } from '@/libs/github/client';
import { createProject, addDomain, addEnvVar, getEnvVars } from '@/libs/vercel/client';
import type { Database } from '@/libs/supabase/types';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'freewebsite.deal';

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
    user_id: string;
    business_id: string;
    site_slug: string;
  };

  const { user_id, business_id, site_slug } = body;

  if (!user_id || !business_id || !site_slug) {
    return NextResponse.json({ error: 'user_id, business_id, and site_slug are required' }, { status: 400 });
  }

  // Strict server-side validation — only lowercase alphanumeric + hyphens, 3-50 chars
  const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
  if (!SLUG_RE.test(site_slug)) {
    return NextResponse.json(
      { error: 'site_slug must be 3–50 characters, lowercase letters, numbers, and hyphens only (no leading/trailing hyphens)' },
      { status: 400 },
    );
  }

  const repoName = site_slug;
  const subdomain = `${site_slug}.${ROOT_DOMAIN}`;

  try {
    // 1. Insert a provisioning record immediately so the UI can show progress
    const { data: website, error: insertError } = await supabaseAdmin
      .from('aa_demo_deployed_websites')
      .insert({
        user_id,
        business_id,
        site_slug: repoName,
        subdomain,
        status: 'provisioning',
        approval_status: 'pending',
      })
      .select()
      .single();

    if (insertError) throw new Error(`DB insert failed: ${insertError.message}`);

    // 2. Create GitHub repo from template
    const repo = await createRepoFromTemplate(repoName);

    await supabaseAdmin
      .from('aa_demo_deployed_websites')
      .update({ github_repo_name: repo.name, github_repo_url: repo.html_url })
      .eq('id', website.id);

    // 3. Create Vercel project linked to the GitHub repo
    const vercelProject = await createProject(repoName, repoName);

    await supabaseAdmin
      .from('aa_demo_deployed_websites')
      .update({ vercel_project_id: vercelProject.id })
      .eq('id', website.id);

    // 4. Assign subdomain on Vercel
    await addDomain(vercelProject.id, subdomain);

    // 5. Copy platform env vars to the customer Vercel project
    // VERCEL_PROJECT_ID must be set in the platform's env — it's the freewebsite.deal project ID
    const platformProjectId = process.env.VERCEL_PROJECT_ID;
    if (platformProjectId) {
      const platformEnv = await getEnvVars(platformProjectId);
      const keysToCopy = ['FORWARDEMAIL_API_KEY'];
      for (const key of keysToCopy) {
        if (platformEnv[key]) {
          await addEnvVar(vercelProject.id, key, platformEnv[key]);
        }
      }
    }

    // 6. Patch site.config.ts in the new repo with customer-specific values
    // GitHub needs a moment after template generation before files are readable
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const customerEmail = authUser?.user?.email;
    if (customerEmail) {
      let configContent: string | null = null;
      let configSha: string | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const file = await getRepoFile(repoName, 'site.config.ts');
          configContent = file.content;
          configSha = file.sha;
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
      if (configContent && configSha) {
        const patched = configContent
          .replace(
            /contactFormTo:\s*['"](.*?)['"],/,
            `contactFormTo: '${customerEmail}',`,
          )
          .replace(
            /fromEmail:\s*['"](.*?)['"],/,
            `fromEmail: 'noreply@${subdomain}',`,
          );
        await upsertRepoFile(
          repoName,
          'site.config.ts',
          patched,
          'chore: set customer email and from address',
          'main',
          configSha,
        );
      }
    }

    await supabaseAdmin
      .from('aa_demo_deployed_websites')
      .update({
        status: 'building',
        dev_url: `https://${subdomain}`,
        approval_status: 'pending',
      })
      .eq('id', website.id);

    return NextResponse.json({
      success: true,
      website_id: website.id,
      repo_url: repo.html_url,
      vercel_project_id: vercelProject.id,
      subdomain,
      live_url: `https://${subdomain}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[provision-site] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
