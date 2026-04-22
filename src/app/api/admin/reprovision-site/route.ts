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

/**
 * POST /api/admin/reprovision-site
 *
 * For customers who already have a `deployed_websites` row but whose GitHub repo
 * and Vercel project were never created (vercel_project_id / github_repo_name null).
 * This route completes provisioning in-place without inserting a new row.
 *
 * Body: { website_id: string }
 */
export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as { website_id: string };
  const { website_id } = body;

  if (!website_id) {
    return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
  }

  // Fetch the existing website record
  const { data: website, error: fetchError } = await supabaseAdmin
    .from('aa_demo_deployed_websites')
    .select('*')
    .eq('id', website_id)
    .single();

  if (fetchError || !website) {
    return NextResponse.json({ error: 'Website record not found' }, { status: 404 });
  }

  if (website.vercel_project_id && website.github_repo_name) {
    return NextResponse.json({ error: 'Site is already fully provisioned' }, { status: 400 });
  }

  // Derive the slug: prefer site_slug, fall back to subdomain prefix
  const slug = (website as any).site_slug
    ?? (website.subdomain ? website.subdomain.split('.')[0] : null);

  if (!slug) {
    return NextResponse.json(
      { error: 'No site_slug or subdomain found — cannot derive repo name' },
      { status: 400 },
    );
  }

  const repoName = slug;
  const subdomain = website.subdomain ?? `${slug}.${ROOT_DOMAIN}`;

  try {
    // 1. Create GitHub repo from template (skip if already done)
    let repoUrl = (website as any).github_repo_url as string | null;
    if (!website.github_repo_name) {
      const repo = await createRepoFromTemplate(repoName);
      repoUrl = repo.html_url;
      await supabaseAdmin
        .from('aa_demo_deployed_websites')
        .update({ github_repo_name: repo.name, github_repo_url: repo.html_url })
        .eq('id', website.id);
    }

    // 2. Create Vercel project linked to the GitHub repo (skip if already done)
    // Wait for GitHub to fully index the repo before Vercel tries to link it
    if (!website.github_repo_name) {
      await new Promise((r) => setTimeout(r, 8000));
    }

    let vercelProjectId = website.vercel_project_id;
    if (!vercelProjectId) {
      const vercelProject = await createProject(repoName, repoName);
      vercelProjectId = vercelProject.id;
      await supabaseAdmin
        .from('aa_demo_deployed_websites')
        .update({ vercel_project_id: vercelProject.id })
        .eq('id', website.id);
    }

    // 3. Assign subdomain on Vercel
    await addDomain(vercelProjectId, subdomain);

    // 4. Copy platform env vars
    const platformProjectId = process.env.VERCEL_PROJECT_ID;
    if (platformProjectId) {
      const platformEnv = await getEnvVars(platformProjectId);
      const keysToCopy = ['FORWARDEMAIL_API_KEY'];
      for (const key of keysToCopy) {
        if (platformEnv[key]) {
          await addEnvVar(vercelProjectId, key, platformEnv[key]);
        }
      }
    }

    // 5. Patch site.config.ts with customer email
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(website.user_id);
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
          .replace(/contactFormTo:\s*['"](.*?)['"],/, `contactFormTo: '${customerEmail}',`)
          .replace(/fromEmail:\s*['"](.*?)['"],/, `fromEmail: 'noreply@${subdomain}',`);
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

    // 6. Mark as building
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
      vercel_project_id: vercelProjectId,
      subdomain,
      repo_url: repoUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[reprovision-site] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
