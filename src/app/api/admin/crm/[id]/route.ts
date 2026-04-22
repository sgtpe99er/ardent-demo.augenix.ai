import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';

async function assertAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: session.user.id } as any);
  return isAdmin ? session : null;
}

// GET /api/admin/crm/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await assertAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { data, error } = await supabaseAdminClient
      .from('crm_prospects' as any)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ prospect: data });
  } catch (error) {
    console.error('CRM GET [id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateSubdomain(name: string): string {
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

// PATCH /api/admin/crm/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await assertAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    // Strip read-only fields
    delete body.id;
    delete body.created_at;

    // If converting to 'converted' stage, create a linked Customer if not already linked
    if (body.prospect_stage === 'converted') {
      const { data: existing } = await supabaseAdminClient
        .from('crm_prospects' as any)
        .select('fwd_user_id, business_name')
        .eq('id', id)
        .single();

      if (existing && !(existing as any).fwd_user_id) {
        const businessName = (existing as any).business_name ?? '';
        const slug = businessName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 40)
          .replace(/^-+|-+$/g, '');
        const suffix = Math.random().toString(36).slice(2, 6);
        const email = `${slug || 'customer'}-${suffix}@prospect.freewebsite.deal`;

        const { data: newUser, error: createError } =
          await supabaseAdminClient.auth.admin.createUser({
            email,
            email_confirm: true,
          });

        if (!createError && newUser.user) {
          const userId = newUser.user.id;
          await supabaseAdminClient.from('aa_demo_businesses').insert({
            user_id: userId,
            business_name: businessName || null,
            status: 'onboarding',
          } as any);

          const subdomain = generateSubdomain(businessName || 'site');
          await supabaseAdminClient.from('deployed_websites' as any).insert({
            user_id: userId,
            subdomain,
            status: 'building',
            approval_status: 'pending',
          });

          body.fwd_user_id = userId;
        } else {
          console.error('Failed to create customer on conversion:', createError);
        }
      }
    }

    const { data, error } = await supabaseAdminClient
      .from('crm_prospects' as any)
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ prospect: data });
  } catch (error) {
    console.error('CRM PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/crm/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await assertAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { error } = await supabaseAdminClient
      .from('crm_prospects' as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CRM DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
