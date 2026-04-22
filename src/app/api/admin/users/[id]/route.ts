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
  const {
    role, // 'user' | 'admin'
    email,
    businessName,
    industry,
    locationCity,
    locationState,
    locationCountry,
    targetAudience,
    servicesProducts,
    websiteFeatures,
    websiteNotes,
    status,
  } = body;

  // Update email if provided
  if (email !== undefined) {
    const { error: emailError } = await supabaseAdminClient.auth.admin.updateUserById(userId, { email });
    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 500 });
    }
  }

  // Update role if provided
  if (role !== undefined) {
    if (role === 'admin') {
      // Upsert into admin_users
      const { data: existing } = await supabaseAdminClient
        .from('aa_demo_admin_users')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!existing) {
        await supabaseAdminClient.from('aa_demo_admin_users').insert({ user_id: userId } as any);
      }
    } else {
      // Remove from admin_users
      await supabaseAdminClient.from('aa_demo_admin_users').delete().eq('user_id', userId);
    }
  }

  // Update business record if fields provided
  const businessUpdate: Record<string, unknown> = {};
  if (businessName !== undefined) businessUpdate.business_name = businessName;
  if (industry !== undefined) businessUpdate.industry = industry;
  if (locationCity !== undefined) businessUpdate.location_city = locationCity;
  if (locationState !== undefined) businessUpdate.location_state = locationState;
  if (locationCountry !== undefined) businessUpdate.location_country = locationCountry;
  if (targetAudience !== undefined) businessUpdate.target_audience = targetAudience;
  if (servicesProducts !== undefined) businessUpdate.services_products = servicesProducts;
  if (websiteFeatures !== undefined) businessUpdate.website_features = websiteFeatures;
  if (websiteNotes !== undefined) businessUpdate.website_notes = websiteNotes;
  if (status !== undefined) businessUpdate.status = status;

  if (Object.keys(businessUpdate).length > 0) {
    businessUpdate.updated_at = new Date().toISOString();
    await supabaseAdminClient
      .from('aa_demo_businesses')
      .update(businessUpdate as any)
      .eq('user_id', userId);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: userId } = await params;

  // Prevent self-deletion
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  // Delete auth user (cascades to related data via FK or RLS)
  const { error } = await supabaseAdminClient.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
