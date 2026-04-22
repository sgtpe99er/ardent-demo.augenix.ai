import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { businessId } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch business data
  const { data: business, error: bizError } = await supabase
    .from('aa_demo_businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (bizError || !business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  // Cast to Record to handle columns that may not be in Database types yet
  const biz = business as Record<string, unknown>;

  // Fetch brand_assets for social links - use user_id since that's how Onboarding saves it
  const userId = biz.user_id as string;
  const { data: brandAssets } = await supabase
    .from('aa_demo_brand_assets')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Cast brand_assets to Record for new columns
  const assets = (brandAssets || {}) as Record<string, unknown>;

  // Build the Website Guide data directly from businesses and brand_assets tables
  // Using the correct column names that the Onboarding tab saves to
  const data = {
    // Business Basics - from businesses table (matching Onboarding column names)
    businessName: biz.business_name || '',
    industry: biz.industry || '',
    industryOther: '', // Not stored in DB, only used during onboarding
    tagline: biz.tagline || '',
    yearEstablished: biz.year_established || null,
    description: biz.description || '',
    addressStreet: biz.address_street || '',
    addressCity: biz.location_city || '', // Onboarding saves to location_city
    addressState: biz.location_state || '', // Onboarding saves to location_state
    addressZip: biz.address_zip || '',
    addressCountry: biz.location_country || '', // Onboarding saves to location_country
    phonePrimary: biz.phone_primary || '',
    emailPublic: biz.email_public || '',
    hours: biz.hours || {},

    // Domain - from businesses table
    ownsDomain: biz.owns_domain || false,
    existingDomain: biz.existing_domain || '', // Onboarding saves to existing_domain
    domainRegistrar: biz.domain_registrar || '',
    desiredDomain: biz.desired_domain || '',
    existingWebsiteUrl: assets.existing_website_url || '', // This is in brand_assets
    needsDomainPurchase: biz.needs_domain_purchase || false,
    emailAddresses: (biz.email_addresses as string[]) || [],

    // Online Presence - from brand_assets table
    socialFacebook: assets.social_facebook || '',
    socialInstagram: assets.social_instagram || '',
    socialYoutube: assets.social_youtube || '',
    socialX: assets.social_x || '',
    socialTiktok: assets.social_tiktok || '',
    socialLinkedin: assets.social_linkedin || '',
    socialGoogleBusiness: assets.social_google_business || assets.google_business_url || '',
    socialYelp: assets.social_yelp || '',
    socialOther: [],

    // SEO & Target Market - from businesses table
    targetAudience: biz.target_audience || '',
    servicesProducts: biz.services_products || '',
    targetLocations: biz.target_locations || [],
    serviceAreaRadius: biz.service_area_radius || '',
    serviceAreaDescription: biz.service_area_description || '',
    serviceKeywords: biz.service_keywords || [],
    competitorUrls: biz.competitor_urls || [],

    // Website Features - from businesses table
    websiteFeatures: biz.website_features || [],
    primaryCta: biz.primary_cta || '',
    leadFormFields: biz.lead_form_fields || [],
    licenses: biz.licenses || [],
    insuranceInfo: biz.insurance_info || '',
    associations: biz.associations || [],
    paymentMethods: biz.payment_methods || [],
    uniqueSellingPoints: biz.unique_selling_points || [],
    specialOffers: biz.special_offers || [],
    languagesServed: biz.languages_served || [],
    integrationsNeeded: biz.integrations_needed || [],
  };

  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const session = await checkAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { businessId } = await params;
    const supabase = await createSupabaseServerClient();
    const updates = await request.json();
    console.log('Website Guide PATCH - received updates:', JSON.stringify(updates, null, 2));

    // First get the business to find the user_id for brand_assets
    const { data: business } = await supabase
      .from('aa_demo_businesses')
      .select('user_id')
      .eq('id', businessId)
      .single();

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const userId = (business as { user_id: string }).user_id;

    // Map updates to business table columns (using same column names as Onboarding)
    const businessUpdates: Record<string, unknown> = {};
    const brandAssetUpdates: Record<string, unknown> = {};

    // Business Basics - use same column names as Onboarding saves
    if ('businessName' in updates) businessUpdates.business_name = updates.businessName;
    if ('industry' in updates) businessUpdates.industry = updates.industry;
    if ('tagline' in updates) businessUpdates.tagline = updates.tagline;
    if ('yearEstablished' in updates) businessUpdates.year_established = updates.yearEstablished;
    if ('description' in updates) businessUpdates.description = updates.description;
    if ('addressStreet' in updates) businessUpdates.address_street = updates.addressStreet;
    if ('addressCity' in updates) businessUpdates.location_city = updates.addressCity;
    if ('addressState' in updates) businessUpdates.location_state = updates.addressState;
    if ('addressZip' in updates) businessUpdates.address_zip = updates.addressZip;
    if ('addressCountry' in updates) businessUpdates.location_country = updates.addressCountry;
    if ('phonePrimary' in updates) businessUpdates.phone_primary = updates.phonePrimary;
    if ('emailPublic' in updates) businessUpdates.email_public = updates.emailPublic;
    if ('hours' in updates) businessUpdates.hours = updates.hours;

    // Domain - use same column names as Onboarding saves
    if ('ownsDomain' in updates) businessUpdates.owns_domain = updates.ownsDomain;
    if ('existingDomain' in updates) businessUpdates.existing_domain = updates.existingDomain;
    if ('domainRegistrar' in updates) businessUpdates.domain_registrar = updates.domainRegistrar;
    if ('desiredDomain' in updates) businessUpdates.desired_domain = updates.desiredDomain;
    if ('needsDomainPurchase' in updates) businessUpdates.needs_domain_purchase = updates.needsDomainPurchase;
    if ('emailAddresses' in updates) businessUpdates.email_addresses = updates.emailAddresses;
    if ('existingWebsiteUrl' in updates) brandAssetUpdates.existing_website_url = updates.existingWebsiteUrl;

    // SEO & Target Market
    if ('targetAudience' in updates) businessUpdates.target_audience = updates.targetAudience;
    if ('servicesProducts' in updates) businessUpdates.services_products = updates.servicesProducts;
    if ('targetLocations' in updates) businessUpdates.target_locations = updates.targetLocations;
    if ('serviceAreaRadius' in updates) businessUpdates.service_area_radius = updates.serviceAreaRadius;
    if ('serviceAreaDescription' in updates) businessUpdates.service_area_description = updates.serviceAreaDescription;
    if ('serviceKeywords' in updates) businessUpdates.service_keywords = updates.serviceKeywords;
    if ('competitorUrls' in updates) businessUpdates.competitor_urls = updates.competitorUrls;

    // Website Features
    if ('websiteFeatures' in updates) businessUpdates.website_features = updates.websiteFeatures;
    if ('primaryCta' in updates) businessUpdates.primary_cta = updates.primaryCta;
    if ('leadFormFields' in updates) businessUpdates.lead_form_fields = updates.leadFormFields;
    if ('licenses' in updates) businessUpdates.licenses = updates.licenses;
    if ('insuranceInfo' in updates) businessUpdates.insurance_info = updates.insuranceInfo;
    if ('associations' in updates) businessUpdates.associations = updates.associations;
    if ('paymentMethods' in updates) businessUpdates.payment_methods = updates.paymentMethods;
    if ('uniqueSellingPoints' in updates) businessUpdates.unique_selling_points = updates.uniqueSellingPoints;
    if ('specialOffers' in updates) businessUpdates.special_offers = updates.specialOffers;
    if ('languagesServed' in updates) businessUpdates.languages_served = updates.languagesServed;
    if ('integrationsNeeded' in updates) businessUpdates.integrations_needed = updates.integrationsNeeded;

    // Social links go to brand_assets (using same column names as Onboarding)
    if ('socialFacebook' in updates) brandAssetUpdates.social_facebook = updates.socialFacebook;
    if ('socialInstagram' in updates) brandAssetUpdates.social_instagram = updates.socialInstagram;
    if ('socialYoutube' in updates) brandAssetUpdates.social_youtube = updates.socialYoutube;
    if ('socialX' in updates) brandAssetUpdates.social_x = updates.socialX;
    if ('socialTiktok' in updates) brandAssetUpdates.social_tiktok = updates.socialTiktok;
    if ('socialLinkedin' in updates) brandAssetUpdates.social_linkedin = updates.socialLinkedin;
    if ('socialGoogleBusiness' in updates) brandAssetUpdates.social_google_business = updates.socialGoogleBusiness;
    if ('socialYelp' in updates) brandAssetUpdates.social_yelp = updates.socialYelp;

    // Update business table
    if (Object.keys(businessUpdates).length > 0) {
      businessUpdates.updated_at = new Date().toISOString();
      console.log('Website Guide PATCH - businessUpdates:', JSON.stringify(businessUpdates, null, 2));
      const { error: bizError } = await supabase
        .from('aa_demo_businesses')
        .update(businessUpdates as never)
        .eq('id', businessId);

      if (bizError) {
        console.error('Error updating business:', bizError);
        return NextResponse.json({ error: 'Failed to update business', details: bizError.message }, { status: 500 });
      }
    }

    // Update brand_assets table - use user_id like Onboarding does
    if (Object.keys(brandAssetUpdates).length > 0) {
      brandAssetUpdates.updated_at = new Date().toISOString();

      // Check if brand_assets exists for this user
      const { data: existing } = await supabase
        .from('aa_demo_brand_assets')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error: assetError } = await supabase
          .from('aa_demo_brand_assets')
          .update(brandAssetUpdates as never)
          .eq('user_id', userId);

        if (assetError) {
          console.error('Error updating brand_assets:', assetError);
          return NextResponse.json({ error: 'Failed to update brand assets', details: assetError.message }, { status: 500 });
        }
      } else {
        const { error: assetError } = await supabase
          .from('aa_demo_brand_assets')
          .insert({ user_id: userId, ...brandAssetUpdates } as never);

        if (assetError) {
          console.error('Error inserting brand_assets:', assetError);
          return NextResponse.json({ error: 'Failed to create brand assets', details: assetError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Website Guide PATCH - unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
