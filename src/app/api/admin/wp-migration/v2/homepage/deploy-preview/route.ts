import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getRepoFile, upsertRepoFile } from '@/libs/github/client';
import { getLatestDeployment, upsertEnvVar } from '@/libs/vercel/client';

async function logActivity(jobId: string, action: string, message: string) {
  try {
    const { data: job } = await supabaseAdminClient
      .from('migration_jobs')
      .select('build_status')
      .eq('id', jobId)
      .single();
    const buildStatus = ((job?.build_status as any) || {});
    const activity = buildStatus.recent_activity || [];
    activity.push({ timestamp: new Date().toISOString(), action, message });
    await supabaseAdminClient
      .from('migration_jobs')
      .update({ build_status: { ...buildStatus, recent_activity: activity } })
      .eq('id', jobId);
  } catch (e) {
    console.error('[logActivity] Failed:', e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId, customerId, pageLabel } = await request.json();

    if (!jobId || !customerId) {
      return NextResponse.json({ error: 'jobId and customerId required' }, { status: 400 });
    }

    // Get job
    const { data: job, error: jobError } = await supabaseAdminClient
      .from('migration_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const metadata = (job.metadata as any) || {};

    // Require generated code
    const siteConfigCode = metadata.generated_site_config;
    if (!siteConfigCode) {
      return NextResponse.json({ error: 'Site config not generated. Run Generate Config first.' }, { status: 400 });
    }
    const pageCode = metadata.generated_page_code;
    if (!pageCode) {
      return NextResponse.json({ error: 'Page code not generated. Run Generate Page first.' }, { status: 400 });
    }

    await logActivity(jobId, 'deploy_start', 'Starting deploy preview...');

    // Get customer's deployed website record
    const { data: website, error: websiteError } = await supabaseAdminClient
      .from('aa_demo_deployed_websites')
      .select('id, vercel_project_id, github_repo_name, subdomain, site_slug')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (websiteError || !website) {
      return NextResponse.json({ error: 'No deployed website found for this customer. Provision the site first.' }, { status: 404 });
    }

    if (!website.github_repo_name || !website.vercel_project_id) {
      return NextResponse.json({ error: 'Website not fully provisioned (missing GitHub repo or Vercel project).' }, { status: 400 });
    }

    const repoName = website.github_repo_name;
    const subdomain = website.site_slug ?? website.subdomain?.split('.')[0] ?? repoName;
    const customDomain = `${subdomain}.freewebsite.deal`;

    await logActivity(jobId, 'deploy_repo', `Pushing files to ${repoName}...`);

    // 1. Push site.config.ts
    let configSha: string | undefined;
    try {
      const existing = await getRepoFile(repoName, 'site.config.ts');
      configSha = existing.sha;
    } catch {
      // File doesn't exist yet
    }

    await upsertRepoFile(
      repoName,
      'site.config.ts',
      siteConfigCode,
      'feat: migration — generated site.config.ts from WordPress site',
      'main',
      configSha,
    );

    await logActivity(jobId, 'deploy_config_pushed', 'Pushed site.config.ts');

    // 2. Push page.tsx
    let pageSha: string | undefined;
    try {
      const existing = await getRepoFile(repoName, 'src/app/page.tsx');
      pageSha = existing.sha;
    } catch {
      // File doesn't exist yet
    }

    await upsertRepoFile(
      repoName,
      'src/app/page.tsx',
      pageCode,
      'feat: migration — generated home page from WordPress site',
      'main',
      pageSha,
    );

    await logActivity(jobId, 'deploy_page_pushed', 'Pushed src/app/page.tsx');

    // 3. Ensure Vercel env vars are set (Supabase connection for any dynamic features)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

    if (supabaseUrl && supabaseAnonKey) {
      await Promise.all([
        upsertEnvVar(website.vercel_project_id, 'NEXT_PUBLIC_SUPABASE_URL', supabaseUrl),
        upsertEnvVar(website.vercel_project_id, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', supabaseAnonKey),
      ]);
    }

    await logActivity(jobId, 'deploy_env_set', 'Vercel env vars configured');

    // 4. Wait for Vercel to start building (the git push triggers auto-deploy)
    // Poll for a new deployment
    await logActivity(jobId, 'deploy_building', `Vercel is building... Site will be at https://${customDomain}`);

    let deploymentUrl: string | null = null;
    let deploymentReady = false;

    // Poll for up to 120 seconds for deployment to become READY
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));

      try {
        const deployment = await getLatestDeployment(website.vercel_project_id);
        if (deployment) {
          if (deployment.state === 'READY') {
            deploymentUrl = `https://${customDomain}`;
            deploymentReady = true;
            break;
          } else if (deployment.state === 'ERROR') {
            await logActivity(jobId, 'deploy_error', `Vercel build failed: ${deployment.readyState}`);
            break;
          }
          // Still building — continue polling
        }
      } catch {
        // Polling error — continue
      }
    }

    if (!deploymentReady) {
      // Even if not ready yet, the deploy was triggered
      deploymentUrl = `https://${customDomain}`;
      await logActivity(jobId, 'deploy_pending', `Deploy triggered but still building. Check ${deploymentUrl}`);
    } else {
      await logActivity(jobId, 'deploy_ready', `Site is live at ${deploymentUrl}`);
    }

    // Store deploy info in metadata
    metadata.deploy_preview = {
      url: deploymentUrl,
      customDomain,
      repoName,
      deployedAt: new Date().toISOString(),
      ready: deploymentReady,
    };

    // Re-read current build_status from DB
    const { data: freshJob } = await supabaseAdminClient
      .from('migration_jobs')
      .select('build_status')
      .eq('id', jobId)
      .single();
    const buildStatus = ((freshJob?.build_status as any) || {});

    await supabaseAdminClient
      .from('migration_jobs')
      .update({
        metadata,
        build_status: {
          ...buildStatus,
          phase: 'homepage',
          current_step: 'deploy_preview_complete',
          recent_activity: [
            ...(buildStatus.recent_activity || []),
            {
              timestamp: new Date().toISOString(),
              action: 'deploy_complete',
              message: `Deployed to ${deploymentUrl} (${deploymentReady ? 'live' : 'building'})`,
            },
          ],
        },
      })
      .eq('id', jobId);

    return NextResponse.json({
      message: deploymentReady ? 'Deploy preview is live' : 'Deploy triggered, still building',
      deployUrl: deploymentUrl,
      customDomain,
      repoName,
      ready: deploymentReady,
    });
  } catch (error: any) {
    console.error('[wp-migration-v2-deploy-preview] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
