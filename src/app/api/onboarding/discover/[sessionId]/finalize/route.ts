import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseAdminClient
      .from('aa_demo_admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Verify session - admins can access any session
    let query = supabaseAdminClient
      .from('onboarding_discovery_sessions')
      .select('*')
      .eq('id', sessionId);

    if (!adminUser) {
      query = query.eq('user_id', user.id);
    }

    const { data: session } = await query.single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get confirmed items
    const { data: confirmedItems } = await supabaseAdminClient
      .from('onboarding_discovery_items')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'confirmed');

    // Build the data to save to businesses table - use session's user_id (the customer)
    const businessData: Record<string, any> = {
      user_id: session.user_id,
    };

    const brandAssetsData: Record<string, any> = {};

    const items = (confirmedItems || []) as Array<{
      field_type: string;
      field_value: any;
    }>;

    for (const item of items) {
      const value = item.field_value;

      switch (item.field_type) {
        case 'business_name':
          businessData.name = value;
          break;
        case 'tagline':
          businessData.tagline = value;
          break;
        case 'description':
          businessData.description = value;
          break;
        case 'phone':
          businessData.phone_primary = value;
          break;
        case 'email':
          businessData.email_public = value;
          break;
        case 'address':
          if (typeof value === 'object') {
            businessData.address_street = value.street;
            businessData.address_city = value.city;
            businessData.address_state = value.state;
            businessData.address_zip = value.zip;
            businessData.address_country = value.country;
          }
          break;
        case 'hours':
          // Transform from { monday: "09:00 – 17:00" } to { mon: { open: "09:00", close: "17:00" } }
          if (typeof value === 'object') {
            const dayMap: Record<string, string> = {
              monday: 'mon', tuesday: 'tue', wednesday: 'wed',
              thursday: 'thu', friday: 'fri', saturday: 'sat', sunday: 'sun',
            };
            const hours: Record<string, { open: string; close: string }> = {};
            for (const [day, timeStr] of Object.entries(value)) {
              const key = dayMap[day] || day;
              if (typeof timeStr === 'string' && timeStr) {
                const parts = timeStr.split(/\s*[–-]\s*/);
                hours[key] = { open: parts[0]?.trim() || '', close: parts[1]?.trim() || '' };
              } else {
                hours[key] = { open: '', close: '' };
              }
            }
            businessData.hours = hours;
          }
          break;
        case 'website':
          brandAssetsData.existing_website_url = value;
          break;
        case 'social_facebook':
          brandAssetsData.facebook_page_url = value;
          brandAssetsData.social_facebook = value;
          break;
        case 'social_instagram':
          brandAssetsData.social_instagram = value;
          break;
        case 'social_youtube':
          brandAssetsData.social_youtube = value;
          break;
        case 'social_linkedin':
          brandAssetsData.social_linkedin = value;
          break;
        case 'social_x':
          brandAssetsData.social_x = value;
          break;
        case 'services':
          businessData.services_products = Array.isArray(value) ? value.join(', ') : value;
          break;
        case 'logo':
          brandAssetsData.logo_urls = Array.isArray(value) ? value : [value];
          break;
        case 'brand_colors':
          brandAssetsData.brand_colors = Array.isArray(value) ? value : [value];
          break;
      }
    }

    // Check if business already exists for the customer (session's user_id)
    const targetUserId = session.user_id as string;
    const { data: existingBusiness } = await supabaseAdminClient
      .from('aa_demo_businesses')
      .select('id')
      .eq('user_id', targetUserId)
      .single();

    let businessId: string;

    if (existingBusiness) {
      businessId = existingBusiness.id;
      // Update existing business
      if (Object.keys(businessData).length > 1) { // more than just user_id
        await supabaseAdminClient
          .from('aa_demo_businesses')
          .update(businessData)
          .eq('id', businessId);
      }
    } else {
      // Create new business
      businessData.status = 'onboarding';
      const { data: newBusiness } = await supabaseAdminClient
        .from('aa_demo_businesses')
        .insert(businessData as any)
        .select('id')
        .single();
      businessId = newBusiness?.id ?? '';
    }

    // Upsert brand_assets if we have brand/social data
    if (Object.keys(brandAssetsData).length > 0 && businessId) {
      const { data: existingAssets } = await supabaseAdminClient
        .from('aa_demo_brand_assets')
        .select('id')
        .eq('user_id', targetUserId)
        .single();

      if (existingAssets) {
        await supabaseAdminClient
          .from('aa_demo_brand_assets')
          .update(brandAssetsData as any)
          .eq('id', existingAssets.id);
      } else {
        await supabaseAdminClient.from('aa_demo_brand_assets').insert({
          user_id: targetUserId,
          business_id: businessId,
          ...brandAssetsData,
        } as any);
      }
    }

    // Update session status
    await supabaseAdminClient
      .from('onboarding_discovery_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        confirmed_data: items.reduce((acc, item) => {
          acc[item.field_type] = item.field_value;
          return acc;
        }, {} as Record<string, any>),
      })
      .eq('id', sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Finalize discovery error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
