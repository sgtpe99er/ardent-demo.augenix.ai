import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', {
    user_uuid: session.user.id,
  } as any);
  return isAdmin ? session : null;
}

// Helper to upsert brand_assets
async function upsertBrandAssets(userId: string, update: Record<string, unknown>) {
  if (Object.keys(update).length === 0) return null;
  update.updated_at = new Date().toISOString();

  const { data: existing } = await supabaseAdminClient
    .from('aa_demo_brand_assets')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdminClient
      .from('aa_demo_brand_assets')
      .update(update as any)
      .eq('user_id', userId);
    return error;
  } else {
    const { error } = await supabaseAdminClient
      .from('aa_demo_brand_assets')
      .insert({ user_id: userId, ...update } as any);
    return error;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: userId } = await params;
  const body = await request.json();
  const { step, responses } = body;

  if (!step || !responses) {
    return NextResponse.json({ error: 'Missing step or responses' }, { status: 400 });
  }

  // Step 1: Business Basics → businesses table
  if (step === 1) {
    const r = responses;
    const businessUpdate: Record<string, unknown> = {};
    if (r.businessName !== undefined) businessUpdate.business_name = r.businessName;
    if (r.industry !== undefined) businessUpdate.industry = r.industry;
    if (r.yearEstablished !== undefined) businessUpdate.year_established = r.yearEstablished ? parseInt(r.yearEstablished) : null;
    if (r.tagline !== undefined) businessUpdate.tagline = r.tagline;
    if (r.description !== undefined) businessUpdate.description = r.description;
    if (r.addressStreet !== undefined) businessUpdate.address_street = r.addressStreet;
    if (r.addressCity !== undefined) businessUpdate.location_city = r.addressCity;
    if (r.addressState !== undefined) businessUpdate.location_state = r.addressState;
    if (r.addressZip !== undefined) businessUpdate.address_zip = r.addressZip;
    if (r.addressCountry !== undefined) businessUpdate.location_country = r.addressCountry;
    if (r.phonePrimary !== undefined) businessUpdate.phone_primary = r.phonePrimary;
    if (r.phoneSecondary !== undefined) businessUpdate.phone_secondary = r.phoneSecondary;
    if (r.emailPublic !== undefined) businessUpdate.email_public = r.emailPublic;
    if (r.hours !== undefined) businessUpdate.hours = r.hours;

    if (Object.keys(businessUpdate).length > 0) {
      businessUpdate.updated_at = new Date().toISOString();
      const { error } = await supabaseAdminClient
        .from('aa_demo_businesses')
        .update(businessUpdate as any)
        .eq('user_id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Step 2: Domain & Social → businesses (domain) + brand_assets (social)
  if (step === 2) {
    const r = responses;
    // Domain fields go to businesses
    const businessUpdate: Record<string, unknown> = {};
    if (r.ownsDomain !== undefined) businessUpdate.owns_domain = r.ownsDomain;
    if (r.existingDomain !== undefined) businessUpdate.existing_domain = r.existingDomain;
    if (r.domainRegistrar !== undefined) businessUpdate.domain_registrar = r.domainRegistrar;
    if (r.desiredDomain !== undefined) businessUpdate.desired_domain = r.desiredDomain;
    if (r.needsDomainPurchase !== undefined) businessUpdate.needs_domain_purchase = r.needsDomainPurchase;

    if (Object.keys(businessUpdate).length > 0) {
      businessUpdate.updated_at = new Date().toISOString();
      const { error } = await supabaseAdminClient
        .from('aa_demo_businesses')
        .update(businessUpdate as any)
        .eq('user_id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Social fields go to brand_assets
    const brandUpdate: Record<string, unknown> = {};
    if (r.existingWebsiteUrl !== undefined) brandUpdate.existing_website_url = r.existingWebsiteUrl;
    if (r.socialFacebook !== undefined) brandUpdate.social_facebook = r.socialFacebook;
    if (r.socialInstagram !== undefined) brandUpdate.social_instagram = r.socialInstagram;
    if (r.socialYoutube !== undefined) brandUpdate.social_youtube = r.socialYoutube;
    if (r.socialX !== undefined) brandUpdate.social_x = r.socialX;
    if (r.socialTiktok !== undefined) brandUpdate.social_tiktok = r.socialTiktok;
    if (r.socialLinkedin !== undefined) brandUpdate.social_linkedin = r.socialLinkedin;
    if (r.socialGoogleBusiness !== undefined) brandUpdate.social_google_business = r.socialGoogleBusiness;
    if (r.socialYelp !== undefined) brandUpdate.social_yelp = r.socialYelp;

    const brandError = await upsertBrandAssets(userId, brandUpdate);
    if (brandError) return NextResponse.json({ error: brandError.message }, { status: 500 });
  }

  // Step 3: SEO & Target Market → businesses table
  if (step === 3) {
    const r = responses;
    const businessUpdate: Record<string, unknown> = {};
    if (r.targetLocations !== undefined) businessUpdate.target_locations = r.targetLocations;
    if (r.serviceAreaRadius !== undefined) businessUpdate.service_area_radius = r.serviceAreaRadius;
    if (r.serviceAreaDescription !== undefined) businessUpdate.service_area_description = r.serviceAreaDescription;
    if (r.targetAudience !== undefined) businessUpdate.target_audience = r.targetAudience;
    if (r.servicesProducts !== undefined) businessUpdate.services_products = r.servicesProducts;
    if (r.serviceKeywords !== undefined) businessUpdate.service_keywords = r.serviceKeywords;
    if (r.competitorUrls !== undefined) businessUpdate.competitor_urls = r.competitorUrls;

    if (Object.keys(businessUpdate).length > 0) {
      businessUpdate.updated_at = new Date().toISOString();
      const { error } = await supabaseAdminClient
        .from('aa_demo_businesses')
        .update(businessUpdate as any)
        .eq('user_id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Step 4: Brand & Style → brand_assets table
  if (step === 4) {
    const r = responses;
    const brandUpdate: Record<string, unknown> = {};
    if (r.hasExistingLogo !== undefined) brandUpdate.has_existing_logo = r.hasExistingLogo;
    if (r.logoUrls !== undefined) brandUpdate.logo_urls = r.logoUrls;
    if (r.hasBrandColors !== undefined) brandUpdate.has_brand_colors = r.hasBrandColors;
    if (r.brandColors !== undefined) brandUpdate.brand_colors = r.brandColors;
    if (r.hasBrandFonts !== undefined) brandUpdate.has_brand_fonts = r.hasBrandFonts;
    if (r.brandFonts !== undefined) brandUpdate.brand_fonts = r.brandFonts;
    if (r.stylePreference !== undefined) brandUpdate.style_preference = r.stylePreference;
    if (r.toneOfVoice !== undefined) brandUpdate.tone_of_voice = r.toneOfVoice;
    if (r.colorPreference !== undefined) brandUpdate.color_preference = r.colorPreference;
    if (r.fontPreference !== undefined) brandUpdate.font_preference = r.fontPreference;
    if (r.inspirationUrls !== undefined) brandUpdate.inspiration_urls = r.inspirationUrls;
    if (r.inspirationNotes !== undefined) brandUpdate.inspiration_notes = r.inspirationNotes;

    const brandError = await upsertBrandAssets(userId, brandUpdate);
    if (brandError) return NextResponse.json({ error: brandError.message }, { status: 500 });
  }

  // Step 5: Content & Media → brand_assets table
  if (step === 5) {
    const r = responses;
    const brandUpdate: Record<string, unknown> = {};
    if (r.uploadedLogos !== undefined) brandUpdate.uploaded_logos = r.uploadedLogos;
    if (r.uploadedPhotos !== undefined) brandUpdate.uploaded_photos = r.uploadedPhotos;
    if (r.uploadedTeamPhotos !== undefined) brandUpdate.uploaded_team_photos = r.uploadedTeamPhotos;
    if (r.uploadedPortfolio !== undefined) brandUpdate.uploaded_portfolio = r.uploadedPortfolio;
    if (r.uploadedInspiration !== undefined) brandUpdate.uploaded_inspiration = r.uploadedInspiration;
    if (r.uploadedOther !== undefined) brandUpdate.uploaded_other = r.uploadedOther;
    if (r.testimonials !== undefined) brandUpdate.testimonials = r.testimonials;
    if (r.certifications !== undefined) brandUpdate.certifications = r.certifications;
    if (r.awards !== undefined) brandUpdate.awards = r.awards;
    if (r.faqs !== undefined) brandUpdate.faqs = r.faqs;

    const brandError = await upsertBrandAssets(userId, brandUpdate);
    if (brandError) return NextResponse.json({ error: brandError.message }, { status: 500 });
  }

  // Step 6: Website Features → businesses table
  if (step === 6) {
    const r = responses;
    const businessUpdate: Record<string, unknown> = {};
    if (r.websiteFeatures !== undefined) businessUpdate.website_features = r.websiteFeatures;
    if (r.primaryCta !== undefined) businessUpdate.primary_cta = r.primaryCta;
    if (r.leadFormFields !== undefined) businessUpdate.lead_form_fields = r.leadFormFields;
    if (r.licenses !== undefined) businessUpdate.licenses = r.licenses;
    if (r.insuranceInfo !== undefined) businessUpdate.insurance_info = r.insuranceInfo;
    if (r.associations !== undefined) businessUpdate.associations = r.associations;
    if (r.paymentMethods !== undefined) businessUpdate.payment_methods = r.paymentMethods;
    if (r.uniqueSellingPoints !== undefined) businessUpdate.unique_selling_points = r.uniqueSellingPoints;
    if (r.specialOffers !== undefined) businessUpdate.special_offers = r.specialOffers;
    if (r.languagesServed !== undefined) businessUpdate.languages_served = r.languagesServed;
    if (r.integrationsNeeded !== undefined) businessUpdate.integrations_needed = r.integrationsNeeded;

    if (Object.keys(businessUpdate).length > 0) {
      businessUpdate.updated_at = new Date().toISOString();
      const { error } = await supabaseAdminClient
        .from('aa_demo_businesses')
        .update(businessUpdate as any)
        .eq('user_id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
