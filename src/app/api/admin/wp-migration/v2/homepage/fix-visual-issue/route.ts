import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getRepoFile, upsertRepoFile } from '@/libs/github/client';
import { getLatestDeployment } from '@/libs/vercel/client';
import { launchBrowser } from '@/libs/puppeteer/browser';
import sharp from 'sharp';

export const maxDuration = 300;

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

async function callAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI Gateway error (${res.status}): ${errorText}`);
  }
  const completion = await res.json();
  return completion.choices?.[0]?.message?.content || '';
}

async function callAIWithImages(apiKey: string, model: string, systemPrompt: string, imageMessages: any[], maxTokens: number): Promise<string> {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: imageMessages },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI Gateway error (${res.status}): ${errorText}`);
  }
  const completion = await res.json();
  return completion.choices?.[0]?.message?.content || '';
}

async function fetchImageAsCompressedBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const compressed = await sharp(buffer)
      .resize(1280, 7000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return compressed.toString('base64');
  } catch {
    return null;
  }
}

const SCREENSHOT_BUCKET = 'migration-screenshots';

export async function POST(request: NextRequest) {
  try {
    const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
    if (!AI_GATEWAY_API_KEY) {
      return NextResponse.json({ error: 'AI Gateway API key not configured' }, { status: 500 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId, issueKey, issueNotes } = await request.json();
    if (!jobId || !issueKey) {
      return NextResponse.json({ error: 'Job ID and issue key required' }, { status: 400 });
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

    let metadata = (job.metadata as any) || {};
    const visualQaReport = metadata.visual_qa_report;
    if (!visualQaReport) {
      return NextResponse.json({ error: 'No Visual QA report found. Run Visual QA first.' }, { status: 400 });
    }

    let currentSiteConfig = metadata.generated_site_config;
    let currentPageCode = metadata.generated_page_code;
    if (!currentSiteConfig || !currentPageCode) {
      return NextResponse.json({ error: 'Generated code not found.' }, { status: 400 });
    }

    const issueLabel = issueKey.replace(/_/g, ' ');
    const issueScore = visualQaReport.scores?.[issueKey];
    const issueDescription = issueScore?.notes || issueNotes || 'No details provided';

    await logActivity(jobId, 'fix_visual_start', `Fixing visual issue: ${issueLabel} (score: ${issueScore?.score || '?'}/10)...`);

    const rawLib = metadata.component_library;
    const componentLibrary = Array.isArray(rawLib) ? rawLib : (rawLib?.components || []);

    // Build the fix prompt focused on this specific visual issue
    const fixPrompt = `You are fixing a SPECIFIC visual issue in a WordPress-to-Next.js migration.

## THE ISSUE TO FIX
**Category**: ${issueLabel}
**Current Score**: ${issueScore?.score || '?'}/10
**Problem Description**: ${issueDescription}

## CURRENT site.config.ts
${currentSiteConfig}

## CURRENT page.tsx
${currentPageCode}

## FULL VISUAL QA REPORT CONTEXT
Overall Score: ${visualQaReport.overall_score}/10
Top Issues: ${(visualQaReport.top_issues || []).join('; ')}
Recommendations: ${(visualQaReport.recommendations || []).join('; ')}

## REUSABLE BLOCK COMPONENTS (import from @/components/blocks/)
You MUST use these for matching sections. Do NOT recreate their functionality inline.
1. ServicesGrid - props: { services: { icon: string, title: string, description: string }[] }
2. GalleryGrid - props: { images: { src: string, alt: string }[], headline: string, subtext: string, showViewAllLink?: boolean }
3. Testimonials - props: { testimonials: { name: string, quote: string, rating: number }[] }
4. CTABanner - props: { headline: string, phone: string, phoneRaw: string, address: string, directionsUrl: string, primaryLabel: string, primaryHref: string }
5. ContactForm - (self-contained form component, no props needed)
6. GoogleMap - props: { embedUrl: string }
7. MenuDisplay - props: { categories: { name: string, items: { name: string, description: string }[] }[] }

## UI COMPONENTS
- Container - wrapper with max-width and padding. Use it for EVERY section content.
- Button - styled button with variants (default, outline, ghost) and sizes (sm, default, lg). Use 'asChild' prop with Link or <a>.

## DESIGN SYSTEM — CRITICAL RULES

### globals.css base styles (already applied globally, do NOT re-declare):
- h1: font-alt font-bold text-4xl text-brand-cream lg:text-6xl
- h2: font-alt font-semibold text-2xl text-brand-cream lg:text-4xl
- h3: font-alt font-semibold text-xl text-brand-cream
- body: bg-background text-foreground

### Brand CSS variables (Tailwind classes — set by siteConfig in layout.tsx):
- text-brand-primary, bg-brand-primary → accent color
- text-brand-secondary, bg-brand-secondary → secondary color
- text-brand-text → body text color
- text-brand-cream → light heading/accent text
- bg-brand-bg → page background
- bg-background → dark background (default black)

### Fonts (via Tailwind):
- font-sans → Montserrat (default body, already on body)
- font-alt → Montserrat Alternates (headings, already on h1-h3)

### Icons: react-icons/io5 only

## ABSOLUTE RULES — VIOLATIONS WILL FAIL QA
1. NEVER use inline styles (style={{ }}). Use ONLY Tailwind CSS classes.
2. NEVER use style JSX (<style jsx>). Use ONLY Tailwind CSS classes.
3. NEVER hardcode colors as hex/rgb values. Use brand-* Tailwind classes or standard Tailwind colors.
4. NEVER hardcode font-family. Fonts are set globally.
5. NEVER duplicate block component functionality. If a section matches ServicesGrid, Testimonials, CTABanner, etc., USE the block.
6. ALL text content must come from siteConfig — NEVER hardcode business text.
7. Wrap ALL section content in <Container>.
8. Use responsive Tailwind classes (mobile-first): sm:, md:, lg:, xl: breakpoints.
9. Use Next.js <Image> for all images.
10. Use <Button> component (with asChild) for CTAs.
11. CRITICAL: In page.tsx, ONLY destructure and reference siteConfig properties that ACTUALLY EXIST in the site.config.ts shown above. Read it carefully. If a property like serviceAreas, financing, process, chat, etc. does NOT exist in the config, do NOT reference it in page.tsx — the build WILL fail with a TypeScript error. If you need a new property, you MUST add it to the site.config.ts file in your response.
12. NEVER add new imports for modules that don't exist in the template (e.g. custom hooks, utilities). Only use: next/image, next/link, react-icons/io5, @/components/container, @/components/ui/button, @/components/blocks/*, and the site.config import.

## INSTRUCTIONS
Fix ONLY the "${issueLabel}" issue described above. Make targeted changes to address this specific problem.

Return BOTH files as a single response in this exact format:

===SITE_CONFIG_START===
(complete updated site.config.ts code)
===SITE_CONFIG_END===

===PAGE_CODE_START===
(complete updated page.tsx code)
===PAGE_CODE_END===

Rules:
- Return the COMPLETE file contents, not just the changed parts
- Focus on fixing the specific issue: "${issueLabel}"
- Keep all existing working code intact — only change what needs fixing for this issue
- Follow ALL the absolute rules above — especially NO inline styles`;

    const fixResponse = await callAI(
      AI_GATEWAY_API_KEY,
      'anthropic/claude-opus-4.6',
      'You are an expert Next.js developer fixing a specific visual issue. Focus only on the issue described. Return the complete updated files in the exact format requested. No markdown fences around the code blocks — just the delimiters as specified.',
      fixPrompt,
      12000,
    );

    // Parse the fixed code
    const configMatch = fixResponse.match(/===SITE_CONFIG_START===\s*([\s\S]*?)\s*===SITE_CONFIG_END===/);
    const pageMatch = fixResponse.match(/===PAGE_CODE_START===\s*([\s\S]*?)\s*===PAGE_CODE_END===/);

    if (!configMatch && !pageMatch) {
      await logActivity(jobId, 'fix_visual_parse_error', `AI response didn't contain expected delimiters. Trying fallback parse...`);
      // Fallback: try to extract any code blocks
      const codeBlocks = fixResponse.split(/```(?:typescript|tsx|ts)?\n?/).filter((_: string, i: number) => i % 2 === 1);
      if (codeBlocks.length >= 2) {
        currentSiteConfig = codeBlocks[0].replace(/```\s*$/gm, '').trim();
        currentPageCode = codeBlocks[1].replace(/```\s*$/gm, '').trim();
      } else if (codeBlocks.length === 1) {
        currentPageCode = codeBlocks[0].replace(/```\s*$/gm, '').trim();
      } else {
        await logActivity(jobId, 'fix_visual_failed', `Could not parse AI fix response.`);
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
      }
    } else {
      if (configMatch) currentSiteConfig = configMatch[1].replace(/^```(?:typescript|tsx|ts)?\n?/gm, '').replace(/```\s*$/gm, '').trim();
      if (pageMatch) currentPageCode = pageMatch[1].replace(/^```(?:typescript|tsx|ts)?\n?/gm, '').replace(/```\s*$/gm, '').trim();
    }

    await logActivity(jobId, 'fix_visual_applied', `Fixed "${issueLabel}" (config: ${currentSiteConfig.length} chars, page: ${currentPageCode.length} chars)`);

    // Track fix history for visual issues
    const visualFixHistory: any[] = metadata.visual_fix_history || [];
    visualFixHistory.push({
      timestamp: new Date().toISOString(),
      issueKey,
      issueLabel,
      previousScore: issueScore?.score || null,
    });

    // Save updated code
    metadata.generated_site_config = currentSiteConfig;
    metadata.generated_site_config_at = new Date().toISOString();
    metadata.generated_page_code = currentPageCode;
    metadata.generated_page_code_at = new Date().toISOString();
    metadata.visual_fix_history = visualFixHistory;

    // ══════════════════════════════════════════════════════════════════════════
    // AUTO-REDEPLOY
    // ══════════════════════════════════════════════════════════════════════════
    await logActivity(jobId, 'fix_visual_redeploy', `Auto-redeploying after fixing "${issueLabel}"...`);

    // Get customer's deployed website record
    const { data: website, error: websiteError } = await supabaseAdminClient
      .from('aa_demo_deployed_websites')
      .select('id, vercel_project_id, github_repo_name, subdomain, site_slug')
      .eq('user_id', job.customer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (websiteError || !website || !website.github_repo_name || !website.vercel_project_id) {
      // Can't auto-deploy, just save the fix
      await logActivity(jobId, 'fix_visual_no_deploy', `No deployed website found — fix saved, manual redeploy required.`);
      
      delete metadata.deploy_preview;
      delete metadata.visual_qa_report;
      delete metadata.visual_qa_at;
      delete metadata.visual_qa_screenshots;

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
            current_step: 'visual_fix_applied',
          },
        })
        .eq('id', jobId);

      return NextResponse.json({
        message: `Fixed "${issueLabel}". Manual redeploy required.`,
        issueKey,
        issueLabel,
        needsRedeploy: true,
      });
    }

    const repoName = website.github_repo_name;
    const subdomain = website.site_slug ?? website.subdomain?.split('.')[0] ?? repoName;
    const customDomain = `${subdomain}.freewebsite.deal`;

    // Push site.config.ts
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
      currentSiteConfig,
      `fix: visual QA — fixed ${issueLabel}`,
      'main',
      configSha,
    );

    // Push page.tsx
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
      currentPageCode,
      `fix: visual QA — fixed ${issueLabel}`,
      'main',
      pageSha,
    );

    await logActivity(jobId, 'fix_visual_pushed', `Pushed updated files to ${repoName}`);

    // Wait for Vercel deployment
    let deploymentUrl: string | null = null;
    let deploymentReady = false;

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
            await logActivity(jobId, 'fix_visual_deploy_error', `Vercel build failed`);
            break;
          }
        }
      } catch {
        // Polling error — continue
      }
    }

    if (!deploymentReady) {
      deploymentUrl = `https://${customDomain}`;
      await logActivity(jobId, 'fix_visual_deploy_pending', `Deploy triggered but still building`);
    } else {
      await logActivity(jobId, 'fix_visual_deployed', `Site redeployed to ${deploymentUrl}`);
    }

    // Store deploy info
    metadata.deploy_preview = {
      url: deploymentUrl,
      customDomain,
      repoName,
      deployedAt: new Date().toISOString(),
      ready: deploymentReady,
    };

    // ══════════════════════════════════════════════════════════════════════════
    // TARGETED VISUAL QA — Only re-evaluate the fixed issue
    // ══════════════════════════════════════════════════════════════════════════
    if (deploymentReady && deploymentUrl) {
      await logActivity(jobId, 'fix_visual_qa_start', `Running targeted Visual QA for "${issueLabel}"...`);

      // Get original screenshots
      const targetUrl = job.target_url;
      const targetUrlAlt = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl + '/';

      let homepage: any = null;
      const { data: exactMatch } = await supabaseAdminClient
        .from('migration_pages')
        .select('original_screenshot_url, mobile_screenshot_url, url')
        .eq('job_id', jobId)
        .eq('url', targetUrl)
        .single();

      if (exactMatch) {
        homepage = exactMatch;
      } else {
        const { data: altMatch } = await supabaseAdminClient
          .from('migration_pages')
          .select('original_screenshot_url, mobile_screenshot_url, url')
          .eq('job_id', jobId)
          .eq('url', targetUrlAlt)
          .single();
        if (altMatch) homepage = altMatch;
      }

      if (homepage?.original_screenshot_url) {
        // Take new screenshots
        const browser = await launchBrowser();
        let newDesktopBase64: string = '';
        let newMobileBase64: string = '';
        let persistedDesktopUrl: string = '';
        let persistedMobileUrl: string = '';

        try {
          // Desktop screenshot
          const desktopPage = await browser.newPage();
          await desktopPage.setViewport({ width: 1920, height: 1080 });
          await desktopPage.goto(deploymentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await new Promise(r => setTimeout(r, 3000));
          const desktopFullPng = await desktopPage.screenshot({ fullPage: true, type: 'png' }) as Buffer;
          const desktopJpeg = await desktopPage.screenshot({ fullPage: false, type: 'jpeg', quality: 70 }) as Buffer;
          const desktopForAi = await sharp(desktopJpeg)
            .resize(1280, 7000, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();
          newDesktopBase64 = desktopForAi.toString('base64');
          await desktopPage.close();

          // Mobile screenshot
          const mobilePage = await browser.newPage();
          await mobilePage.setViewport({ width: 375, height: 667 });
          await mobilePage.goto(deploymentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await new Promise(r => setTimeout(r, 3000));
          const mobileFullPng = await mobilePage.screenshot({ fullPage: true, type: 'png' }) as Buffer;
          const mobileJpeg = await mobilePage.screenshot({ fullPage: false, type: 'jpeg', quality: 70 }) as Buffer;
          const mobileForAi = await sharp(mobileJpeg)
            .resize(1280, 7000, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();
          newMobileBase64 = mobileForAi.toString('base64');
          await mobilePage.close();

          // Upload screenshots
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const desktopPath = `${jobId}/new-site/desktop-${timestamp}.png`;
          await supabaseAdminClient.storage
            .from(SCREENSHOT_BUCKET)
            .upload(desktopPath, desktopFullPng, { contentType: 'image/png', upsert: true });
          const { data: desktopUrlData } = supabaseAdminClient.storage
            .from(SCREENSHOT_BUCKET)
            .getPublicUrl(desktopPath);
          persistedDesktopUrl = desktopUrlData.publicUrl;

          const mobilePath = `${jobId}/new-site/mobile-${timestamp}.png`;
          await supabaseAdminClient.storage
            .from(SCREENSHOT_BUCKET)
            .upload(mobilePath, mobileFullPng, { contentType: 'image/png', upsert: true });
          const { data: mobileUrlData } = supabaseAdminClient.storage
            .from(SCREENSHOT_BUCKET)
            .getPublicUrl(mobilePath);
          persistedMobileUrl = mobileUrlData.publicUrl;
        } finally {
          await browser.close();
        }

        // Fetch original screenshots
        const oldDesktopBase64 = await fetchImageAsCompressedBase64(homepage.original_screenshot_url);
        const oldMobileBase64 = homepage.mobile_screenshot_url
          ? await fetchImageAsCompressedBase64(homepage.mobile_screenshot_url)
          : null;

        if (oldDesktopBase64 && newDesktopBase64) {
          // Build targeted QA prompt for just this issue
          const imageMessages: any[] = [];

          imageMessages.push({ type: 'text', text: '## ORIGINAL WORDPRESS SITE — Desktop Screenshot:' });
          imageMessages.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${oldDesktopBase64}` } });
          imageMessages.push({ type: 'text', text: '## NEW NEXT.JS SITE — Desktop Screenshot:' });
          imageMessages.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${newDesktopBase64}` } });

          if (oldMobileBase64) {
            imageMessages.push({ type: 'text', text: '## ORIGINAL WORDPRESS SITE — Mobile Screenshot:' });
            imageMessages.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${oldMobileBase64}` } });
          }
          imageMessages.push({ type: 'text', text: '## NEW NEXT.JS SITE — Mobile Screenshot:' });
          imageMessages.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${newMobileBase64}` } });

          imageMessages.push({
            type: 'text',
            text: `## TARGETED VISUAL QA — Re-evaluate ONLY the "${issueLabel}" category

The previous score for "${issueLabel}" was: ${issueScore?.score || '?'}/10
Previous notes: ${issueDescription}

We attempted to fix this specific issue. Please re-evaluate ONLY this category.

Return as JSON:
{
  "issue_key": "${issueKey}",
  "previous_score": ${issueScore?.score || 0},
  "new_score": <0-10>,
  "improved": <true/false>,
  "notes": "...",
  "remaining_issues": ["..."] or []
}`,
          });

          const qaResponse = await callAIWithImages(
            AI_GATEWAY_API_KEY,
            'anthropic/claude-opus-4.6',
            'You are an expert visual QA engineer. Re-evaluate ONLY the specific category mentioned. Be thorough and critical. Return ONLY valid JSON.',
            imageMessages,
            1500,
          );

          let targetedQaResult: any;
          try {
            targetedQaResult = JSON.parse(qaResponse);
          } catch {
            const jsonMatch = qaResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              targetedQaResult = JSON.parse(jsonMatch[0]);
            }
          }

          if (targetedQaResult) {
            // Update the visual_qa_report with the new score for this issue
            const existingReport = visualQaReport || { scores: {}, overall_score: 0 };
            existingReport.scores[issueKey] = {
              score: targetedQaResult.new_score,
              notes: targetedQaResult.notes,
            };

            // Recalculate overall score
            const allScores = Object.values(existingReport.scores) as { score: number }[];
            const avgScore = allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length;
            existingReport.overall_score = Math.round(avgScore * 10) / 10;
            existingReport.ready_for_deployment = avgScore >= 7;

            metadata.visual_qa_report = existingReport;
            metadata.visual_qa_at = new Date().toISOString();
            metadata.visual_qa_screenshots = {
              old_desktop: homepage.original_screenshot_url,
              old_mobile: homepage.mobile_screenshot_url || null,
              new_desktop: persistedDesktopUrl,
              new_mobile: persistedMobileUrl,
            };

            // Update fix history with result
            const lastFix = visualFixHistory[visualFixHistory.length - 1];
            if (lastFix) {
              lastFix.newScore = targetedQaResult.new_score;
              lastFix.improved = targetedQaResult.improved;
              lastFix.notes = targetedQaResult.notes;
            }
            metadata.visual_fix_history = visualFixHistory;

            const improvement = targetedQaResult.new_score - (issueScore?.score || 0);
            await logActivity(
              jobId,
              'fix_visual_qa_done',
              `"${issueLabel}": ${issueScore?.score || '?'}/10 → ${targetedQaResult.new_score}/10 (${improvement >= 0 ? '+' : ''}${improvement})`
            );
          }
        }
      }
    }

    // Save final state
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
          current_step: 'visual_fix_complete',
          recent_activity: [
            ...(buildStatus.recent_activity || []),
            {
              timestamp: new Date().toISOString(),
              action: 'visual_fix_complete',
              message: `Fixed, redeployed, and re-evaluated "${issueLabel}"`,
            },
          ],
        },
      })
      .eq('id', jobId);

    const lastFix = visualFixHistory[visualFixHistory.length - 1];
    return NextResponse.json({
      message: `Fixed "${issueLabel}", redeployed, and re-evaluated.`,
      issueKey,
      issueLabel,
      previousScore: issueScore?.score || null,
      newScore: lastFix?.newScore || null,
      improved: lastFix?.improved || false,
      deployUrl: deploymentUrl,
    });
  } catch (error: any) {
    console.error('[wp-migration-v2-fix-visual-issue] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
