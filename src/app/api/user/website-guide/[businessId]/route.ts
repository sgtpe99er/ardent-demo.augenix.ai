import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { getSession } from '@/features/account/controllers/get-session';
import { sendEmail } from '@/libs/email/mailer';

async function getAuthorizedBusiness(businessId: string, userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from('aa_demo_businesses')
    .select('*')
    .eq('id', businessId)
    .eq('user_id', userId)
    .single();

  if (error || !business) {
    return { supabase, business: null };
  }

  return { supabase, business: business as Record<string, unknown> };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { businessId } = await params;
  const { supabase, business } = await getAuthorizedBusiness(businessId, session.user.id);

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const { data: brandAssets } = await supabase
    .from('aa_demo_brand_assets')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const assets = (brandAssets || {}) as Record<string, unknown>;

  const data = {
    websiteGuideApprovedAt: business.website_guide_approved_at || null,
    businessName: business.business_name || '',
    industry: business.industry || '',
    industryOther: '',
    tagline: business.tagline || '',
    yearEstablished: business.year_established || null,
    description: business.description || '',
    addressStreet: business.address_street || '',
    addressCity: business.location_city || '',
    addressState: business.location_state || '',
    addressZip: business.address_zip || '',
    addressCountry: business.location_country || '',
    phonePrimary: business.phone_primary || '',
    emailPublic: business.email_public || '',
    hours: business.hours || {},
    ownsDomain: business.owns_domain || false,
    existingDomain: business.existing_domain || '',
    domainRegistrar: business.domain_registrar || '',
    desiredDomain: business.desired_domain || '',
    existingWebsiteUrl: assets.existing_website_url || '',
    needsDomainPurchase: business.needs_domain_purchase || false,
    emailAddresses: (business.email_addresses as string[]) || [],
    socialFacebook: assets.social_facebook || '',
    socialInstagram: assets.social_instagram || '',
    socialYoutube: assets.social_youtube || '',
    socialX: assets.social_x || '',
    socialTiktok: assets.social_tiktok || '',
    socialLinkedin: assets.social_linkedin || '',
    socialGoogleBusiness: assets.social_google_business || assets.google_business_url || '',
    socialYelp: assets.social_yelp || '',
    socialOther: [],
    targetAudience: business.target_audience || '',
    servicesProducts: business.services_products || '',
    targetLocations: business.target_locations || [],
    serviceAreaRadius: business.service_area_radius || '',
    serviceAreaDescription: business.service_area_description || '',
    serviceKeywords: business.service_keywords || [],
    competitorUrls: business.competitor_urls || [],
    websiteFeatures: business.website_features || [],
    primaryCta: business.primary_cta || '',
    leadFormFields: business.lead_form_fields || [],
    licenses: business.licenses || [],
    insuranceInfo: business.insurance_info || '',
    associations: business.associations || [],
    paymentMethods: business.payment_methods || [],
    uniqueSellingPoints: business.unique_selling_points || [],
    specialOffers: business.special_offers || [],
    languagesServed: business.languages_served || [],
    integrationsNeeded: business.integrations_needed || [],
  };

  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { businessId } = await params;
    const { supabase, business } = await getAuthorizedBusiness(businessId, session.user.id);

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const updates = await request.json();
    const businessUpdates: Record<string, unknown> = {};
    const brandAssetUpdates: Record<string, unknown> = {};

    if ('businessName' in updates) businessUpdates.business_name = updates.businessName;
    if ('websiteGuideApprovedAt' in updates) businessUpdates.website_guide_approved_at = updates.websiteGuideApprovedAt;
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
    if ('ownsDomain' in updates) businessUpdates.owns_domain = updates.ownsDomain;
    if ('existingDomain' in updates) businessUpdates.existing_domain = updates.existingDomain;
    if ('domainRegistrar' in updates) businessUpdates.domain_registrar = updates.domainRegistrar;
    if ('desiredDomain' in updates) businessUpdates.desired_domain = updates.desiredDomain;
    if ('needsDomainPurchase' in updates) businessUpdates.needs_domain_purchase = updates.needsDomainPurchase;
    if ('emailAddresses' in updates) businessUpdates.email_addresses = updates.emailAddresses;
    if ('existingWebsiteUrl' in updates) brandAssetUpdates.existing_website_url = updates.existingWebsiteUrl;
    if ('targetAudience' in updates) businessUpdates.target_audience = updates.targetAudience;
    if ('servicesProducts' in updates) businessUpdates.services_products = updates.servicesProducts;
    if ('targetLocations' in updates) businessUpdates.target_locations = updates.targetLocations;
    if ('serviceAreaRadius' in updates) businessUpdates.service_area_radius = updates.serviceAreaRadius;
    if ('serviceAreaDescription' in updates) businessUpdates.service_area_description = updates.serviceAreaDescription;
    if ('serviceKeywords' in updates) businessUpdates.service_keywords = updates.serviceKeywords;
    if ('competitorUrls' in updates) businessUpdates.competitor_urls = updates.competitorUrls;
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
    if ('socialFacebook' in updates) brandAssetUpdates.social_facebook = updates.socialFacebook;
    if ('socialInstagram' in updates) brandAssetUpdates.social_instagram = updates.socialInstagram;
    if ('socialYoutube' in updates) brandAssetUpdates.social_youtube = updates.socialYoutube;
    if ('socialX' in updates) brandAssetUpdates.social_x = updates.socialX;
    if ('socialTiktok' in updates) brandAssetUpdates.social_tiktok = updates.socialTiktok;
    if ('socialLinkedin' in updates) brandAssetUpdates.social_linkedin = updates.socialLinkedin;
    if ('socialGoogleBusiness' in updates) brandAssetUpdates.social_google_business = updates.socialGoogleBusiness;
    if ('socialYelp' in updates) brandAssetUpdates.social_yelp = updates.socialYelp;

    const isNewApproval = 'websiteGuideApprovedAt' in updates && updates.websiteGuideApprovedAt && !business.website_guide_approved_at;

    if (Object.keys(businessUpdates).length > 0) {
      businessUpdates.updated_at = new Date().toISOString();
      const { error: businessError } = await supabase
        .from('aa_demo_businesses')
        .update(businessUpdates as never)
        .eq('id', businessId)
        .eq('user_id', session.user.id);

      if (businessError) {
        return NextResponse.json({ error: 'Failed to update business', details: businessError.message }, { status: 500 });
      }
    }

    if (isNewApproval) {
      const adminEmail = process.env.FORWARDEMAIL_SMTP_USER ?? 'support@freewebsite.deal';
      const businessName = (business.business_name as string | null) ?? 'Unknown';
      const customerEmail = session.user.email ?? '';
      await sendEmail({
        to: adminEmail,
        subject: `[Website Guide] ${businessName} submitted for review`,
        text: `A customer has submitted their Website Guide for review.\n\nBusiness: ${businessName}\nCustomer email: ${customerEmail}\nBusiness ID: ${businessId}\n\nLog in to the admin dashboard to review it.`,
      }).catch((err: unknown) => console.error('[website-guide] Admin notification failed:', err));
    }

    if (Object.keys(brandAssetUpdates).length > 0) {
      brandAssetUpdates.updated_at = new Date().toISOString();

      const { data: existingBrandAsset } = await supabase
        .from('aa_demo_brand_assets')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existingBrandAsset) {
        const { error: brandAssetError } = await supabase
          .from('aa_demo_brand_assets')
          .update(brandAssetUpdates as never)
          .eq('user_id', session.user.id);

        if (brandAssetError) {
          return NextResponse.json({ error: 'Failed to update brand assets', details: brandAssetError.message }, { status: 500 });
        }
      } else {
        const { error: brandAssetError } = await supabase
          .from('aa_demo_brand_assets')
          .insert({
            user_id: session.user.id,
            business_id: businessId,
            ...brandAssetUpdates,
          } as never);

        if (brandAssetError) {
          return NextResponse.json({ error: 'Failed to create brand assets', details: brandAssetError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
