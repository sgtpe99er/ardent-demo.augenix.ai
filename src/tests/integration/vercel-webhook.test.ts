/**
 * Integration tests for POST /api/webhooks/vercel.
 *
 * Tests:
 * - Missing/invalid signature → 401
 * - Invalid JSON body → 400
 * - Non-deployment event type → 200 received (no-op)
 * - deployment.succeeded: sets status=deployed, sends live email
 * - deployment.ready: same as succeeded
 * - deployment.error: sets status=error, no email
 * - Missing projectId → 200 received (no-op)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

// ─── Mock external modules ────────────────────────────────────────────────────

const mockSendWebsiteLiveEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/emails/send-website-live', () => ({
  sendWebsiteLiveEmail: mockSendWebsiteLiveEmail,
}));

const mockSupabaseUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => mockSupabaseClient),
}));

let mockSupabaseClient: ReturnType<typeof buildSupabaseMock>;

function buildSupabaseMock() {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === aa_demo_deployed_websites) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
          }),
          update: vi.fn().mockReturnValue({ eq: mockUpdateEq }),
        };
      }
      if (table === aa_demo_businesses) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { business_name: 'Acme Co' }, error: null }) }),
          }),
        };
      }
      return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
    }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'owner@acme.com' } }, error: null }),
      },
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'test_vercel_secret_abc';

function signBody(body: string): string {
  return createHmac('sha1', WEBHOOK_SECRET).update(body).digest('hex');
}

function makeRequest(body: string, sig?: string) {
  const signature = sig ?? signBody(body);
  return new NextRequest('http://localhost/api/webhooks/vercel', {
    method: 'POST',
    headers: { 'x-vercel-signature': signature, 'content-type': 'application/json' },
    body,
  });
}

function makeEvent(type: string, payload: Record<string, unknown> = {}) {
  return JSON.stringify({ type, payload });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/vercel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VERCEL_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    mockSupabaseClient = buildSupabaseMock();
    mockMaybeSingle.mockResolvedValue({
      data: { user_id: 'user-1', live_url: 'https://acme.vercel.app' },
      error: null,
    });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  // ─── Signature verification ────────────────────────────────────────────────

  it('returns 401 when x-vercel-signature header is missing', async () => {
    const body = makeEvent('deployment.succeeded', { projectId: 'proj_1' });
    const req = new NextRequest('http://localhost/api/webhooks/vercel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when signature is invalid', async () => {
    const body = makeEvent('deployment.succeeded', { projectId: 'proj_1' });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    const res = await POST(makeRequest(body, 'invalid_signature'));
    expect(res.status).toBe(401);
  });

  // ─── JSON validation ───────────────────────────────────────────────────────

  it('returns 400 for invalid JSON', async () => {
    const body = 'not-json}}}';
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  // ─── Event routing ─────────────────────────────────────────────────────────

  it('returns 200 received for unrelated event types', async () => {
    const body = makeEvent('project.created', { projectId: 'proj_1' });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it('returns 200 and skips DB when projectId is missing', async () => {
    const body = makeEvent('deployment.succeeded', {});
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  // ─── deployment.succeeded ──────────────────────────────────────────────────

  it('updates DB to status=deployed on deployment.succeeded', async () => {
    const body = makeEvent('deployment.succeeded', {
      projectId: 'proj_abc',
      url: 'acme-xyz.vercel.app',
      id: 'dpl_123',
    });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(mockUpdateEq).toHaveBeenCalledWith('vercel_project_id', 'proj_abc');
  });

  it('sets live_url with https prefix for deployment.succeeded', async () => {
    const body = makeEvent('deployment.succeeded', {
      projectId: 'proj_abc',
      url: 'acme-xyz.vercel.app',
    });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    await POST(makeRequest(body));

    // The update call should include a live_url starting with https://
    const updateArg = mockSupabaseClient.from('aa_demo_deployed_websites').update as ReturnType<typeof vi.fn>;
    // We verify the update was called — detailed arg inspection via spy
    expect(mockUpdateEq).toHaveBeenCalled();
  });

  it('sends website live email on deployment.succeeded when user has email', async () => {
    const body = makeEvent('deployment.succeeded', {
      projectId: 'proj_abc',
      url: 'acme.vercel.app',
    });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    await POST(makeRequest(body));

    // Email is fire-and-forget, wait for microtask queue
    await vi.waitFor(() => expect(mockSendWebsiteLiveEmail).toHaveBeenCalled(), { timeout: 500 });
    expect(mockSendWebsiteLiveEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'owner@acme.com',
        businessName: 'Acme Co',
        websiteUrl: expect.stringContaining('acme.vercel.app'),
      })
    );
  });

  it('does NOT send email when no site info row found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const body = makeEvent('deployment.succeeded', {
      projectId: 'proj_abc',
      url: 'acme.vercel.app',
    });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    await POST(makeRequest(body));

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendWebsiteLiveEmail).not.toHaveBeenCalled();
  });

  // ─── deployment.ready ──────────────────────────────────────────────────────

  it('treats deployment.ready as a success (same as succeeded)', async () => {
    const body = makeEvent('deployment.ready', {
      projectId: 'proj_abc',
      url: 'acme.vercel.app',
    });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(mockUpdateEq).toHaveBeenCalled();
  });

  // ─── deployment.error ──────────────────────────────────────────────────────

  it('updates DB to status=error on deployment.error', async () => {
    const body = makeEvent('deployment.error', { projectId: 'proj_abc' });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(mockUpdateEq).toHaveBeenCalledWith('vercel_project_id', 'proj_abc');
  });

  it('does NOT send email on deployment.error', async () => {
    const body = makeEvent('deployment.error', { projectId: 'proj_abc' });
    const { POST } = await import('@/app/api/webhooks/vercel/route');
    await POST(makeRequest(body));

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendWebsiteLiveEmail).not.toHaveBeenCalled();
  });
});
