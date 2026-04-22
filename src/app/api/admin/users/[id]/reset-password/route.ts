import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { supabaseAdminClient } from '@/libs/supabase/supabase-admin';
import { getSession } from '@/features/account/controllers/get-session';
import { sendEmail } from '@/libs/email/mailer';
import { BASE_URL } from '@/features/emails/send-notification';

async function checkAdmin() {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin', { user_uuid: session.user.id } as any);
  return isAdmin ? session : null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;

  // Look up the user's email
  const { data: authUser, error: userError } = await supabaseAdminClient.auth.admin.getUserById(userId);
  if (userError || !authUser?.user?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const email = authUser.user.email;

  // Generate a password reset link via Supabase admin
  const { data: linkData, error: linkError } = await supabaseAdminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${BASE_URL}/account` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkError?.message ?? 'Failed to generate reset link' }, { status: 500 });
  }

  const resetLink = linkData.properties.action_link;

  // Send the email
  await sendEmail({
    to: email,
    subject: 'Reset your FreeWebsite password',
    text: `Hi,\n\nClick the link below to reset your password. This link expires in 24 hours.\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.\n\nBest,\nThe FreeWebsite Team`,
    html: `<p>Hi,</p><p>Click the link below to reset your password. This link expires in 24 hours.</p><p><a href="${resetLink}">Reset Password</a></p><p>If you didn't request this, you can ignore this email.</p><p>Best,<br/>The FreeWebsite Team</p>`,
  });

  // Record timestamp
  await supabaseAdminClient
    .from('aa_demo_businesses')
    .update({ password_reset_sent_at: new Date().toISOString() } as any)
    .eq('user_id', userId);

  return NextResponse.json({ success: true });
}
