/**
 * Asset Generation Orchestrator
 *
 * Coordinates the generation of all assets for a user after payment:
 * 1. Logo (if needed)
 * 2. Color palette (if needed)
 * 3. Branding guide
 * 4. Website mockups
 * 5. Persists results to Supabase + sends notification email
 */

import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { sendAssetsReadyEmail } from '@/features/emails/send-assets-ready';
import { generateBrandingGuide, generateColorSuggestions, generateFontSuggestions } from './anthropic';
import { generateLogoVariations, generateWebsiteMockup } from './stability';
import { AssetGenerationJob, BrandingGuideInput } from './types';

interface GenerateAssetsInput {
  userId: string;
  businessId: string;
  businessName: string;
  industry: string;
  targetAudience: string;
  servicesProducts: string;
  stylePreference: string;
  colorPreference: string;
  hasExistingLogo: boolean;
  existingLogoUrl?: string;
  hasBrandColors: boolean;
  brandColors?: string[];
  existingWebsiteUrl?: string;
}

export async function generateAssets(input: GenerateAssetsInput): Promise<{
  success: boolean;
  assets: {
    logos?: string[];
    colorPalette?: string[];
    fonts?: { heading: string; body: string };
    brandingGuide?: Record<string, unknown>;
    websiteMockups?: string[];
  };
  errors: string[];
}> {
  const db = supabaseAdminClient;
  const assets: {
    logos?: string[];
    colorPalette?: string[];
    fonts?: { heading: string; body: string };
    brandingGuide?: Record<string, unknown>;
    websiteMockups?: string[];
  } = {};
  const errors: string[] = [];

  const upsertAsset = async (
    assetType: string,
    storageUrl: string | null,
    metadata: Record<string, unknown>
  ) => {
    await db
      .from('aa_demo_generated_assets')
      .insert({
        user_id: input.userId,
        business_id: input.businessId,
        asset_type: assetType,
        storage_url: storageUrl,
        metadata,
        status: 'ready',
      } as any);
  };

  try {
    // Step 1: Generate or use existing colors
    if (input.hasBrandColors && input.brandColors) {
      assets.colorPalette = input.brandColors;
    } else {
      const colors = await generateColorSuggestions(input.industry, input.stylePreference);
      assets.colorPalette = colors;
    }
    await upsertAsset('color_palette', null, { colors: assets.colorPalette });

    // Step 2: Generate fonts
    const fonts = await generateFontSuggestions(input.industry, input.stylePreference);
    assets.fonts = fonts;
    await upsertAsset('font_selection', null, { fonts });

    // Step 3: Generate logos (if needed)
    if (!input.hasExistingLogo) {
      const logoVariations = await generateLogoVariations(
        {
          businessName: input.businessName,
          industry: input.industry,
          stylePreference: input.stylePreference,
          colorPalette: assets.colorPalette,
        },
        3
      );
      assets.logos = logoVariations.map((l) => l.imageUrl);
      await upsertAsset('logo', assets.logos[0] ?? null, {
        variations: assets.logos,
        prompts: logoVariations.map((l) => l.prompt),
      });
    }

    // Step 4: Generate branding guide
    const brandingGuideInput: BrandingGuideInput = {
      businessName: input.businessName,
      industry: input.industry,
      targetAudience: input.targetAudience,
      servicesProducts: input.servicesProducts,
      stylePreference: input.stylePreference,
      colorPreference: input.colorPreference,
      existingWebsiteUrl: input.existingWebsiteUrl,
    };
    const brandingGuide = await generateBrandingGuide(brandingGuideInput);
    assets.brandingGuide = brandingGuide as unknown as Record<string, unknown>;
    await upsertAsset('branding_guide', null, assets.brandingGuide);

    // Step 5: Generate website mockups
    const mockups: string[] = [];
    for (let i = 0; i < 3; i++) {
      const mockup = await generateWebsiteMockup(
        input.businessName,
        input.industry,
        input.stylePreference,
        assets.colorPalette
      );
      mockups.push(mockup);
    }
    assets.websiteMockups = mockups;
    await upsertAsset('website_mockup', mockups[0] ?? null, { variations: mockups });

    // Step 6: Update business status to assets_ready
    await db
      .from('aa_demo_businesses')
      .update({ status: 'assets_ready', updated_at: new Date().toISOString() } as any)
      .eq('user_id', input.userId);

    // Step 7: Send notification email
    const { data: authUser } = await db.auth.admin.getUserById(input.userId);
    if (authUser?.user?.email) {
      await sendAssetsReadyEmail({
        userId: input.userId,
        businessName: input.businessName,
        userEmail: authUser.user.email,
      });
    }

    return { success: true, assets, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);
    console.error('Asset generation failed:', errorMessage);

    // Mark business as failed so admin can retry
    await db
      .from('aa_demo_businesses')
      .update({ status: 'paid', updated_at: new Date().toISOString() } as any)
      .eq('user_id', input.userId);

    return { success: false, assets, errors };
  }
}

// Queue processor for background asset generation
const assetQueue: AssetGenerationJob[] = [];

export async function addToAssetQueue(job: Omit<AssetGenerationJob, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const newJob: AssetGenerationJob = {
    ...job,
    id: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date(),
  };
  assetQueue.push(newJob);
  return newJob.id;
}

export async function processAssetQueue(): Promise<void> {
  const pendingJobs = assetQueue.filter(job => job.status === 'pending');
  
  for (const job of pendingJobs) {
    job.status = 'processing';
    
    try {
      // Process based on job type
      switch (job.type) {
        case 'logo':
          // Generate logo
          break;
        case 'branding_guide':
          // Generate branding guide
          break;
        case 'website_copy':
          // Generate website copy
          break;
        case 'website_mockup':
          // Generate website mockup
          break;
      }
      
      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }
}

export function getJobStatus(jobId: string): AssetGenerationJob | undefined {
  return assetQueue.find(job => job.id === jobId);
}
