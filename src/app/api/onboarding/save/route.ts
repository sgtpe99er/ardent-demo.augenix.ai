import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/features/account/controllers/get-session';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) => supabase as any;

const BrandColorSchema = z.object({
  hex: z.string(),
  label: z.string(),
});

const BrandGuideSelectionSchema = z.object({
  selectedLogoVariant: z.string(),
  selectedPaletteId: z.string(),
  selectedHeadingFont: z.string(),
  selectedBodyFont: z.string(),
  selectedDisplayFont: z.string(),
  selectedCtaColor: z.string(),
  notes: z.string(),
});

const IntakeAssetSchema = z.object({
  id: z.string(),
  inputType: z.enum(['file', 'url']),
  title: z.string(),
  notes: z.string(),
  tags: z.array(z.string()),
  sourceUrl: z.string(),
  storageUrl: z.string(),
  storagePath: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  metadata: z.record(z.unknown()),
});

const SaveSchema = z.object({
  step1: z.object({
    businessName: z.string().min(1),
    industry: z.string().min(1),
    industryOther: z.string().optional(),
    yearEstablished: z.number().nullable().optional(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    addressStreet: z.string().optional(),
    addressCity: z.string().min(1),
    addressState: z.string().optional(),
    addressZip: z.string().optional(),
    addressCountry: z.string().min(1),
    phonePrimary: z.string().optional(),
    phoneSecondary: z.string().optional(),
    emailPublic: z.string().optional(),
    hours: z.record(z.object({ open: z.string(), close: z.string() }).nullable()).optional(),
  }).optional(),
  step2: z.object({
    // New structure: Domain & Online Presence
    ownsDomain: z.boolean().optional(),
    existingDomain: z.string().optional(),
    domainRegistrar: z.string().optional(),
    existingWebsiteUrl: z.string().optional(),
    desiredDomain: z.string().optional(),
    needsDomainPurchase: z.boolean().optional(),
    // Social links
    socialFacebook: z.string().optional(),
    socialInstagram: z.string().optional(),
    socialYoutube: z.string().optional(),
    socialX: z.string().optional(),
    socialTiktok: z.string().optional(),
    socialLinkedin: z.string().optional(),
    socialGoogleBusiness: z.string().optional(),
    socialYelp: z.string().optional(),
    // Legacy fields for backward compatibility
    hasExistingWebsite: z.boolean().optional(),
    hasExistingLogo: z.boolean().optional(),
    existingLogoUrl: z.string().optional(),
    hasBusinessCard: z.boolean().optional(),
    businessCardFrontUrl: z.string().optional(),
    businessCardBackUrl: z.string().optional(),
    hasFacebookPage: z.boolean().optional(),
    facebookPageUrl: z.string().optional(),
    stylePreference: z.string().optional(),
    hasBrandColors: z.boolean().optional(),
    brandColors: z.array(z.string()).optional(),
    colorPreference: z.string().optional(),
    hasBrandFonts: z.boolean().optional(),
    brandFonts: z.array(z.string()).optional(),
    fontPreference: z.string().optional(),
  }).optional(),
  step3: z.object({
    // SEO & Target Market
    targetAudience: z.string().min(1),
    servicesProducts: z.string().min(1),
    targetLocations: z.array(z.string()).optional(),
    serviceAreaRadius: z.string().optional(),
    serviceAreaDescription: z.string().optional(),
    serviceKeywords: z.array(z.string()).optional(),
    competitorUrls: z.array(z.string()).optional(),
    websiteFeatures: z.array(z.string()).optional(),
  }).optional(),
  step4: z.object({
    // Brand & Style
    hasExistingLogo: z.boolean().optional(),
    logoUrls: z.array(z.string()).optional(),
    hasBrandColors: z.boolean().optional(),
    brandColors: z.array(BrandColorSchema).optional(),
    hasBrandFonts: z.boolean().optional(),
    brandFonts: z.array(z.string()).optional(),
    stylePreference: z.string().optional(),
    toneOfVoice: z.string().optional(),
    colorPreference: z.string().optional(),
    fontPreference: z.string().optional(),
    inspirationUrls: z.array(z.string()).optional(),
    inspirationNotes: z.string().optional(),
    brandGuideStatus: z.string().optional(),
    brandGuideId: z.string().optional(),
    minimalBrandGuide: z.record(z.unknown()).nullable().optional(),
    brandGuideSelections: BrandGuideSelectionSchema.optional(),
    brandGuidePromptTemplateKey: z.string().optional(),
    // Legacy domain fields
    needsDomain: z.boolean().optional(),
    requestedDomain: z.string().optional(),
    domainPrice: z.number().nullable().optional(),
    selectedDomain: z.string().nullable().optional(),
    selectedDomainOurPrice: z.number().nullable().optional(),
    selectedDomainVercelPrice: z.number().nullable().optional(),
    registrantContact: z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      phone: z.string(),
      address1: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string(),
    }).nullable().optional(),
  }).optional(),
  step5: z.object({
    // Content & Media uploads - just store references
    uploadedLogos: z.array(z.any()).optional(),
    uploadedPhotos: z.array(z.any()).optional(),
    uploadedTeamPhotos: z.array(z.any()).optional(),
    uploadedPortfolio: z.array(z.any()).optional(),
    uploadedInspiration: z.array(z.any()).optional(),
    uploadedDocuments: z.array(z.any()).optional(),
    uploadedOther: z.array(z.any()).optional(),
    uploadedAssets: z.array(IntakeAssetSchema).optional(),
    websiteInspirationUrls: z.array(z.string()).optional(),
    intakeNotes: z.string().optional(),
    existingWebsiteScanEnabled: z.boolean().optional(),
    testimonials: z.array(z.any()).optional(),
    certifications: z.array(z.any()).optional(),
    awards: z.array(z.any()).optional(),
    faqs: z.array(z.any()).optional(),
  }).optional(),
  step6: z.object({
    // Website Features & Preferences
    websiteFeatures: z.array(z.string()).optional(),
    primaryCta: z.string().optional(),
    leadFormFields: z.array(z.string()).optional(),
    insuranceInfo: z.string().optional(),
    associations: z.array(z.string()).optional(),
    paymentMethods: z.array(z.string()).optional(),
    uniqueSellingPoints: z.array(z.string()).optional(),
    languagesServed: z.array(z.string()).optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    // Convert Zod errors to a readable string
    const flattened = parsed.error.flatten();
    const fieldMessages = Object.entries(flattened.fieldErrors)
      .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
      .join('; ');
    const errorMessage = fieldMessages || flattened.formErrors.join(', ') || 'Validation failed';
    return Response.json({ error: errorMessage }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const any = db(supabase);
  const userId = session.user.id;
  const { step1, step2, step3, step4, step5, step6 } = parsed.data;
  const { data: existingBusinessRow } = await any
    .from('aa_demo_businesses')
    .select('id')
    .eq('user_id', userId)
    .single();
  let businessId = existingBusinessRow?.id ?? null;

  // Upsert businesses row (step1 + step2 domain + step3 + step6 fields)
  if (step1 || step2 || step3 || step6) {
    const industryValue = step1?.industry === 'other' ? step1.industryOther : step1?.industry;
    const { data: savedBusiness, error } = await any.from('aa_demo_businesses').upsert(
      {
        user_id: userId,
        ...(step1 && {
          business_name: step1.businessName,
          industry: industryValue ?? step1?.industry,
          year_established: step1.yearEstablished ?? null,
          tagline: step1.tagline ?? null,
          description: step1.description ?? null,
          address_street: step1.addressStreet ?? null,
          location_city: step1.addressCity,
          location_state: step1.addressState ?? null,
          address_zip: step1.addressZip ?? null,
          location_country: step1.addressCountry,
          phone_primary: step1.phonePrimary ?? null,
          phone_secondary: step1.phoneSecondary ?? null,
          email_public: step1.emailPublic ?? null,
          hours: step1.hours ?? null,
        }),
        ...(step2 && {
          owns_domain: step2.ownsDomain ?? false,
          existing_domain: step2.existingDomain ?? null,
          domain_registrar: step2.domainRegistrar ?? null,
          desired_domain: step2.desiredDomain ?? null,
        }),
        ...(step3 && {
          target_audience: step3.targetAudience,
          services_products: step3.servicesProducts,
          target_locations: step3.targetLocations ?? [],
          service_area_radius: step3.serviceAreaRadius ?? null,
          service_area_description: step3.serviceAreaDescription ?? null,
          service_keywords: step3.serviceKeywords ?? [],
          competitor_urls: step3.competitorUrls ?? [],
        }),
        ...(step6 && {
          website_features: step6.websiteFeatures ?? [],
          primary_cta: step6.primaryCta ?? null,
          lead_form_fields: step6.leadFormFields ?? [],
          insurance_info: step6.insuranceInfo ?? null,
          associations: step6.associations ?? [],
          payment_methods: step6.paymentMethods ?? [],
          unique_selling_points: step6.uniqueSellingPoints ?? [],
          languages_served: step6.languagesServed ?? [],
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
      .select('id')
      .single();
    if (error) {
      console.error('[onboarding/save] businesses upsert error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    businessId = savedBusiness?.id ?? businessId;
  }

  // Upsert brand_assets row (step2 socials + step4 brand + step5 uploads)
  if (step2 || step4 || step5) {
    const { error } = await any.from('aa_demo_brand_assets').upsert({
        user_id: userId,
        // Step 2: Online presence & socials
        ...(step2 && {
          has_existing_website: step2.hasExistingWebsite ?? (!!step2.existingWebsiteUrl),
          existing_website_url: step2.existingWebsiteUrl ?? null,
          social_facebook: step2.socialFacebook ?? step2.facebookPageUrl ?? null,
          social_instagram: step2.socialInstagram ?? null,
          social_youtube: step2.socialYoutube ?? null,
          social_x: step2.socialX ?? null,
          social_tiktok: step2.socialTiktok ?? null,
          social_linkedin: step2.socialLinkedin ?? null,
          social_google_business: step2.socialGoogleBusiness ?? null,
          social_yelp: step2.socialYelp ?? null,
          // Legacy fields
          has_facebook_page: step2.hasFacebookPage ?? (!!step2.socialFacebook),
          facebook_page_url: step2.facebookPageUrl ?? step2.socialFacebook ?? null,
          has_business_card: step2.hasBusinessCard ?? false,
          business_card_front_url: step2.businessCardFrontUrl ?? null,
          business_card_back_url: step2.businessCardBackUrl ?? null,
        }),
        // Step 4: Brand & Style
        ...(step4 && {
          has_existing_logo: step4.hasExistingLogo ?? false,
          existing_logo_url: step4.logoUrls?.[0] ?? null,
          logo_urls: step4.logoUrls ?? [],
          style_preference: step4.stylePreference ?? null,
          tone_of_voice: step4.toneOfVoice ?? null,
          has_brand_colors: step4.hasBrandColors ?? false,
          brand_colors: step4.brandColors ?? [],
          color_preference: step4.colorPreference ?? null,
          has_brand_fonts: step4.hasBrandFonts ?? false,
          brand_fonts: step4.brandFonts ?? [],
          font_preference: step4.fontPreference ?? null,
          inspiration_urls: step4.inspirationUrls ?? [],
          inspiration_notes: step4.inspirationNotes ?? null,
          brand_guide_status: step4.brandGuideStatus ?? null,
          brand_guide_id: step4.brandGuideId ?? null,
          minimal_brand_guide: step4.minimalBrandGuide ?? null,
          brand_guide_selections: step4.brandGuideSelections ?? null,
          brand_guide_prompt_template_key: step4.brandGuidePromptTemplateKey ?? 'brand-guide-default',
        }),
        // Step 5: Content uploads
        ...(step5 && {
          uploaded_logos: step5.uploadedLogos ?? [],
          uploaded_photos: step5.uploadedPhotos ?? [],
          uploaded_team_photos: step5.uploadedTeamPhotos ?? [],
          uploaded_portfolio: step5.uploadedPortfolio ?? [],
          uploaded_inspiration: step5.uploadedInspiration ?? [],
          uploaded_documents: step5.uploadedDocuments ?? [],
          uploaded_other: step5.uploadedOther ?? [],
          uploaded_assets: step5.uploadedAssets ?? [],
          website_inspiration_urls: step5.websiteInspirationUrls ?? [],
          intake_notes: step5.intakeNotes ?? null,
          existing_website_scan_enabled: step5.existingWebsiteScanEnabled ?? true,
          testimonials: step5.testimonials ?? [],
          certifications: step5.certifications ?? [],
          awards: step5.awards ?? [],
          faqs: step5.faqs ?? [],
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('[onboarding/save] brand_assets upsert error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (step5?.uploadedAssets) {
    const { error: deleteInputsError } = await any
      .from('aa_demo_customer_inputs')
      .delete()
      .eq('user_id', userId)
      .eq('onboarding_step', 5);
    if (deleteInputsError) {
      console.error('[onboarding/save] customer_inputs delete error:', deleteInputsError);
      return Response.json({ error: deleteInputsError.message }, { status: 500 });
    }

    if (step5.uploadedAssets.length > 0) {
      const rows = step5.uploadedAssets.map((asset) => ({
        id: asset.id,
        user_id: userId,
        business_id: businessId,
        input_type: asset.inputType,
        title: asset.title || null,
        notes: asset.notes ?? '',
        source_url: asset.sourceUrl || null,
        storage_path: asset.storagePath || null,
        storage_url: asset.storageUrl || null,
        file_name: asset.fileName || null,
        mime_type: asset.mimeType || null,
        asset_tags: asset.tags ?? [],
        onboarding_step: 5,
        input_role: 'brand_intake',
        metadata: asset.metadata ?? {},
        updated_at: new Date().toISOString(),
      }));

      const { error: insertInputsError } = await any
        .from('aa_demo_customer_inputs')
        .insert(rows);
      if (insertInputsError) {
        console.error('[onboarding/save] customer_inputs insert error:', insertInputsError);
        return Response.json({ error: insertInputsError.message }, { status: 500 });
      }
    }
  }

  if (step4 || step5) {
    const brandGuidePayload = {
      user_id: userId,
      business_id: businessId,
      customer_id: userId,
      source: 'onboarding',
      status: step4?.brandGuideStatus ?? 'draft',
      minimal_guide: step4?.minimalBrandGuide ?? {},
      selected_config: step4?.brandGuideSelections ?? {},
      prompt_template_key: step4?.brandGuidePromptTemplateKey ?? 'brand-guide-default',
      prompt_context: {
        step2: {
          existingWebsiteUrl: step2?.existingWebsiteUrl ?? undefined,
        },
        step4: step4 ?? undefined,
        step5: step5
          ? {
              websiteInspirationUrls: step5.websiteInspirationUrls ?? [],
              intakeNotes: step5.intakeNotes ?? '',
              existingWebsiteScanEnabled: step5.existingWebsiteScanEnabled ?? true,
              uploadedAssets: step5.uploadedAssets ?? [],
            }
          : undefined,
      },
      guide_data: {
        stylePreference: step4?.stylePreference ?? null,
        toneOfVoice: step4?.toneOfVoice ?? null,
        brandColors: step4?.brandColors ?? [],
        brandFonts: step4?.brandFonts ?? [],
        inspirationUrls: step4?.inspirationUrls ?? [],
        websiteInspirationUrls: step5?.websiteInspirationUrls ?? [],
        intakeAssets: step5?.uploadedAssets ?? [],
      },
      updated_at: new Date().toISOString(),
    };

    const { data: existingBrandGuide, error: existingBrandGuideError } = await any
      .from('brand_guides')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'onboarding')
      .single();
    if (existingBrandGuideError && existingBrandGuideError.code !== 'PGRST116') {
      console.error('[onboarding/save] brand_guides lookup error:', existingBrandGuideError);
      return Response.json({ error: existingBrandGuideError.message }, { status: 500 });
    }

    const brandGuideMutation = existingBrandGuide?.id
      ? any
          .from('brand_guides')
          .update(brandGuidePayload)
          .eq('id', existingBrandGuide.id)
      : any.from('brand_guides').insert(brandGuidePayload);

    const { data: savedBrandGuide, error: brandGuideError } = await brandGuideMutation
      .select('id')
      .single();
    if (brandGuideError) {
      console.error('[onboarding/save] brand_guides upsert error:', brandGuideError);
      return Response.json({ error: brandGuideError.message }, { status: 500 });
    }

    if (savedBrandGuide?.id && step4?.brandGuideId !== savedBrandGuide.id) {
      await any
        .from('aa_demo_brand_assets')
        .update({
          brand_guide_id: savedBrandGuide.id,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }
  }

  // Upsert domain_requests row (step4 legacy fields)
  if (step4) {
    const { error } = await any.from('aa_demo_domain_requests').upsert({
        user_id: userId,
        needs_domain: step4.needsDomain,
        requested_domain: step4.selectedDomain ?? step4.requestedDomain ?? null,
        domain_price: step4.domainPrice ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('[onboarding/save] domain_requests upsert error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Persist registrant contact + selected domain to businesses table
    const businessUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (step4.registrantContact) {
      businessUpdate.domain_registrant_contact = step4.registrantContact;
    }
    if (step4.selectedDomain) {
      businessUpdate.domain_name = step4.selectedDomain;
    }
    if (Object.keys(businessUpdate).length > 1) {
      const { error: bizError } = await any
        .from('aa_demo_businesses')
        .update(businessUpdate)
        .eq('user_id', userId);
      if (bizError) {
        console.error('[onboarding/save] businesses update error:', bizError);
      }
    }
  }

  return Response.json({ ok: true });
}
