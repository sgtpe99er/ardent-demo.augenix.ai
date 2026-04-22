import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/libs/supabase/types';
import { sendWebsiteLiveEmail } from '@/features/emails/send-website-live';

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha1', secret).update(body).digest('hex');
  return signature === expected;
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const body = await req.text();
  const signature = req.headers.get('x-vercel-signature');

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = event.type as string;
  const payload = (event.payload ?? {}) as {
    projectId?: string;
    id?: string;
    url?: string;
    project?: { id?: string };
    deployment?: { id?: string; url?: string };
  };

  // We only care about deployment state changes
  if (type !== 'deployment.succeeded' && type !== 'deployment.error' && type !== 'deployment.ready') {
    return NextResponse.json({ received: true });
  }

  const projectId = payload.projectId ?? payload.project?.id;
  const deploymentUrl = payload.url ?? payload.deployment?.url;
  const deploymentId = payload.id ?? payload.deployment?.id;

  if (!projectId) {
    return NextResponse.json({ received: true });
  }

  const isSuccess = type === 'deployment.succeeded' || type === 'deployment.ready';

  const updates: Record<string, unknown> = {
    status: isSuccess ? 'deployed' : 'error',
    updated_at: new Date().toISOString(),
  };

  if (isSuccess && deploymentUrl) {
    updates.live_url = deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
    updates.vercel_deployment_id = deploymentId ?? null;
    updates.deployed_at = new Date().toISOString();
    updates.approval_status = 'prod_published';
    
    // Fetch business and user info to send the email
    const { data: siteInfo } = await supabaseAdmin
      .from('aa_demo_deployed_websites')
      .select('user_id, live_url')
      .eq('vercel_project_id', projectId)
      .maybeSingle();
      
    if (siteInfo?.user_id && updates.live_url) {
      const { data: businessInfo } = await supabaseAdmin
        .from('aa_demo_businesses')
        .select('business_name')
        .eq('user_id', siteInfo.user_id)
        .maybeSingle();
        
      const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(siteInfo.user_id);
      
      if (userInfo?.user?.email) {
        sendWebsiteLiveEmail({
          userEmail: userInfo.user.email,
          businessName: businessInfo?.business_name ?? 'Your Business',
          websiteUrl: updates.live_url as string,
        }).catch(err => console.error('[vercel-webhook] sendWebsiteLiveEmail failed:', err));
      }
    }
  }

  const { error } = await supabaseAdmin
    .from('aa_demo_deployed_websites')
    .update(updates as Parameters<typeof supabaseAdmin.from>[0] extends never ? never : any)
    .eq('vercel_project_id', projectId);

  if (error) {
    console.error('[vercel-webhook] DB update error:', error.message);
  }

  return NextResponse.json({ received: true });
}
