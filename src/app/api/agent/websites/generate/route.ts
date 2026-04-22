import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { createRepoFromTemplate, getRepoFile, upsertRepoFile, commitMultipleFiles } from '@/libs/github/client';
import { createProject, addDomain } from '@/libs/vercel/client';
import { DESIGN_PAGES, DESIGN_LABELS } from '@/libs/website-variants/home-page-designs';
import { generateDesignVariants, type BusinessInfo } from '@/libs/stitch';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'freewebsite.deal';

function verifyAgentApiKey(request: NextRequest): boolean {
  const key = process.env.FREEWEBSITE_AGENT_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${key}`;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `site-${suffix}`;
}

/**
 * Push all 3 design variant pages to main in a single commit and insert
 * design_variants records with deterministic URLs.
 * No branches or PRs are created.
 */
async function pushDesignPages(
  repoName: string,
  subdomain: string,
  deployedWebsiteId: string,
  businessId: string,
): Promise<void> {
  const db = supabaseAdminClient;

  // Push design-1, design-2, design-3 route pages + update default home page
  const files = [
    { path: 'src/app/design-1/page.tsx', content: DESIGN_PAGES[1] },
    { path: 'src/app/design-2/page.tsx', content: DESIGN_PAGES[2] },
    { path: 'src/app/design-3/page.tsx', content: DESIGN_PAGES[3] },
    { path: 'src/app/page.tsx', content: DESIGN_PAGES[1] },
  ];

  await commitMultipleFiles(
    repoName,
    files,
    'feat: add design variant pages (design-1, design-2, design-3)',
  );

  // Insert design_variants records with deterministic URLs and active status
  for (let variantNumber = 1; variantNumber <= 3; variantNumber++) {
    const label = DESIGN_LABELS[variantNumber];
    try {
      await db.from('design_variants' as any).insert({
        business_id: businessId,
        deployed_website_id: deployedWebsiteId,
        variant_number: variantNumber,
        label,
        github_branch: null,
        vercel_deployment_url: `https://${subdomain}/design-${variantNumber}`,
        thumbnail_url: null,
        status: 'active',
      } as never);
    } catch (err) {
      console.error(`[generate] Failed to insert variant ${variantNumber} record:`, err);
    }
  }
}

/**
 * Generate Stitch AI design variants and upsert them into the design_variants table.
 * Runs in the background via after() after the main response is sent.
 */
async function generateStitchVariants(
  businessInfo: BusinessInfo,
  businessId: string,
  deployedWebsiteId: string,
): Promise<void> {
  if (!process.env.GOOGLE_STITCH_API_KEY) {
    console.warn('[stitch] GOOGLE_STITCH_API_KEY not set — skipping AI variant generation');
    return;
  }

  try {
    const variants = await generateDesignVariants(businessInfo, businessId);
    const db = supabaseAdminClient;

    for (const variant of variants) {
      // Upsert into design_variants — update existing record if already created by branch flow,
      // or insert a new one for this variant number.
      const { data: existing } = await db
        .from('design_variants' as any)
        .select('id')
        .eq('business_id', businessId)
        .eq('variant_number', variant.variantNumber)
        .maybeSingle();

      if (existing) {
        await db
          .from('design_variants' as any)
          .update({
            stitch_project_id: variant.stitch_project_id,
            stitch_screen_id: variant.stitch_screen_id,
            stitch_html_url: variant.stitch_html_url,
            thumbnail_url: variant.thumbnail_url,
            brand_tokens: variant.brand_tokens,
            status: 'active',
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', (existing as any).id);
      } else {
        await db.from('design_variants' as any).insert({
          business_id: businessId,
          deployed_website_id: deployedWebsiteId,
          variant_number: variant.variantNumber,
          label: variant.label,
          github_branch: null,
          stitch_project_id: variant.stitch_project_id,
          stitch_screen_id: variant.stitch_screen_id,
          stitch_html_url: variant.stitch_html_url,
          thumbnail_url: variant.thumbnail_url,
          brand_tokens: variant.brand_tokens,
          status: 'active',
        } as never);
      }
    }

    console.log(`[stitch] Generated ${variants.length} variants for business ${businessId}`);
  } catch (err) {
    console.error('[stitch] generateStitchVariants failed:', err);
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAgentApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, businessData } = body;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = supabaseAdminClient;

  // Verify user exists
  const { data: authUser } = await db.auth.admin.getUserById(userId);
  if (!authUser?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get or create business record
  let { data: business } = await db
    .from('aa_demo_businesses')
    .select('id, business_name')
    .eq('user_id', userId)
    .single();

  if (!business) {
    const { data: newBiz } = await db
      .from('aa_demo_businesses')
      .insert({
        user_id: userId,
        business_name: businessData?.name || null,
        status: 'onboarding',
      } as any)
      .select('id, business_name')
      .single();
    business = newBiz;
  }

  if (!business) {
    return NextResponse.json({ error: 'Failed to create business record' }, { status: 500 });
  }

  // Update business with discovery data if provided
  if (businessData) {
    const updateFields: Record<string, any> = {};
    if (businessData.name) updateFields.business_name = businessData.name;
    if (businessData.phone) updateFields.phone_primary = businessData.phone;
    if (businessData.email) updateFields.email_public = businessData.email;
    if (businessData.address) updateFields.address_street = businessData.address;
    if (businessData.category) updateFields.industry = businessData.category;
    if (businessData.description) updateFields.description = businessData.description;
    if (businessData.services) {
      updateFields.services_products = Array.isArray(businessData.services)
        ? businessData.services.join(', ')
        : businessData.services;
    }
    if (businessData.hours) updateFields.hours = businessData.hours;
    if (businessData.yearsInBusiness) {
      updateFields.year_established = new Date().getFullYear() - businessData.yearsInBusiness;
    }
    updateFields.updated_at = new Date().toISOString();

    await db.from('aa_demo_businesses').update(updateFields as any).eq('id', (business as any).id);
  }

  const businessName = businessData?.name || (business as any).business_name || 'site';
  const siteSlug = slugify(businessName);
  const subdomain = `${siteSlug}.${ROOT_DOMAIN}`;

  try {
    // Check if there's already a deployed website for this user
    const { data: existingWebsite } = await db
      .from('deployed_websites' as any)
      .select('id, subdomain, status, vercel_preview_url')
      .eq('user_id', userId)
      .single();

    if (existingWebsite && (existingWebsite as any).status !== 'building') {
      // Website already provisioned — return existing
      const existingSub = (existingWebsite as any).subdomain;
      return NextResponse.json({
        websiteId: (existingWebsite as any).id,
        subdomain: existingSub,
        previewUrl: `https://${existingSub}`,
        screenshotUrl: null,
        created: false,
        message: 'Website already exists for this user',
      });
    }

    // 1. Create GitHub repo from template
    const repo = await createRepoFromTemplate(siteSlug);

    // 2. Create Vercel project
    const vercelProject = await createProject(siteSlug, siteSlug);

    // 3. Add subdomain
    await addDomain(vercelProject.id, subdomain);

    // 4. Patch site.config.ts with business data
    const customerEmail = authUser.user.email;
    let configPatched = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const file = await getRepoFile(siteSlug, 'site.config.ts');
        if (file.content && file.sha) {
          let patched = file.content;
          if (customerEmail) {
            patched = patched
              .replace(
                /contactFormTo:\s*['"](.*?)['"],/,
                `contactFormTo: '${customerEmail}',`
              )
              .replace(
                /fromEmail:\s*['"](.*?)['"],/,
                `fromEmail: 'noreply@${subdomain}',`
              );
          }
          if (businessName) {
            patched = patched.replace(
              /businessName:\s*['"](.*?)['"],/,
              `businessName: '${businessName.replace(/'/g, "\\'")}',`
            );
          }
          if (businessData?.phone) {
            patched = patched.replace(
              /phone:\s*['"](.*?)['"],/,
              `phone: '${businessData.phone}',`
            );
          }
          await upsertRepoFile(
            siteSlug,
            'site.config.ts',
            patched,
            'chore: configure site for business',
            'main',
            file.sha
          );
          configPatched = true;
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    // 5. Patch app/layout.tsx to inject the Preview Bar script tag
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const layoutFile = await getRepoFile(siteSlug, 'src/app/layout.tsx');
        if (layoutFile.content && layoutFile.sha) {
          // Insert <script> before closing </head> tag, or before </body> if no </head>
          const scriptTag = `<script src="https://${ROOT_DOMAIN}/preview-bar.js" defer></script>`;
          let patched = layoutFile.content;
          if (patched.includes('</head>')) {
            patched = patched.replace('</head>', `${scriptTag}\n</head>`);
          } else if (patched.includes('</body>')) {
            patched = patched.replace('</body>', `${scriptTag}\n</body>`);
          } else {
            // Append before last closing tag as fallback
            patched = patched + `\n{/* Preview Bar */}\n`;
          }
          await upsertRepoFile(
            siteSlug,
            'app/layout.tsx',
            patched,
            'chore: add preview bar script',
            'main',
            layoutFile.sha,
          );
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    // 6. Update deployed_websites record (or create if only a placeholder exists)
    let deployedWebsiteId: string | null = null;

    if (existingWebsite) {
      await db
        .from('deployed_websites' as any)
        .update({
          site_slug: siteSlug,
          subdomain,
          status: 'building',
          github_repo_name: repo.name,
          github_repo_url: repo.html_url,
          vercel_project_id: vercelProject.id,
          business_id: (business as any).id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (existingWebsite as any).id);
      deployedWebsiteId = (existingWebsite as any).id;
    } else {
      const { data: insertedWebsite } = await db
        .from('deployed_websites' as any)
        .insert({
          user_id: userId,
          business_id: (business as any).id,
          site_slug: siteSlug,
          subdomain,
          status: 'building',
          approval_status: 'pending',
          github_repo_name: repo.name,
          github_repo_url: repo.html_url,
          vercel_project_id: vercelProject.id,
        })
        .select('id')
        .single();
      deployedWebsiteId = (insertedWebsite as any)?.id ?? null;
    }

    // 6. Update business status
    await db
      .from('aa_demo_businesses')
      .update({ status: 'website_building', updated_at: new Date().toISOString() } as any)
      .eq('id', (business as any).id);

    // Get the website ID for the response
    const { data: website } = await db
      .from('deployed_websites' as any)
      .select('id')
      .eq('user_id', userId)
      .eq('site_slug', siteSlug)
      .single();

    // 7. Schedule design variant branch creation + Stitch AI generation after response is sent.
    //    Both involve many external API calls — defer with after() to avoid timeout limits.
    if (deployedWebsiteId) {
      const repoName = siteSlug;
      const bizId = (business as any).id;
      const websiteId = deployedWebsiteId;

      // Capture business info for Stitch prompt
      const stitchBusinessInfo: BusinessInfo = {
        name: businessName,
        industry: businessData?.category,
        description: businessData?.description,
        services: Array.isArray(businessData?.services)
          ? businessData.services.join(', ')
          : businessData?.services,
        address: businessData?.address,
        phone: businessData?.phone,
        location: businessData?.address,
      };

      after(async () => {
        // Push design pages to main and run Stitch generation in parallel
        await Promise.allSettled([
          pushDesignPages(repoName, subdomain, websiteId, bizId),
          generateStitchVariants(stitchBusinessInfo, bizId, websiteId),
        ]);
      });
    }

    return NextResponse.json({
      websiteId: (website as any)?.id ?? null,
      subdomain,
      previewUrl: `https://${subdomain}`,
      repoUrl: repo.html_url,
      screenshotUrl: null,
      created: true,
      configPatched,
      variantsScheduled: deployedWebsiteId ? 3 : 0,
    });
  } catch (error) {
    console.error('[Agent Website Generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Website generation failed' },
      { status: 500 }
    );
  }
}
