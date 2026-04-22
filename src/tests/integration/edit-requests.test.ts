/**
 * Integration tests for /api/edit-requests.
 *
 * Tests:
 * - Auth guard
 * - Missing requestDescription → 400
 * - Monthly rate limit → 429 when count >= 5
 * - DB insert error → 500
 * - Happy path → 201
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock external modules ────────────────────────────────────────────────────

const mockGetSession = vi.fn();
vi.mock('@/features/account/controllers/get-session', () => ({
  getSession: mockGetSession,
}));

// Track calls to each table action
const mockEditRequestsSelect = vi.fn();
const mockBusinessesSelect = vi.fn();
const mockEditRequestsInsert = vi.fn();

vi.mock('@/libs/supabase/supabase-server-client', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === aa_demo_edit_requests) {
        return {
          // First call: count query; Second call: insert
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnValue(mockEditRequestsSelect()),
          }),
          insert: mockEditRequestsInsert,
        };
      }
      if (table === aa_demo_businesses) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: mockBusinessesSelect,
          }),
        };
      }
      return {};
    }),
  }),
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/edit-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/edit-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });

    // Default: 0 edits this month (under limit)
    mockEditRequestsSelect.mockReturnValue(Promise.resolve({ count: 0, error: null }));
    mockBusinessesSelect.mockResolvedValue({ data: { id: 'biz-1' }, error: null });
    mockEditRequestsInsert.mockResolvedValue({ error: null });
  });

  // ─── Auth ──────────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/edit-requests/route');
    const res = await POST(makeRequest({ requestDescription: 'Update hero text' }));
    expect(res.status).toBe(401);
  });

  // ─── Validation ────────────────────────────────────────────────────────────

  it('returns 400 when requestDescription is missing', async () => {
    const { POST } = await import('@/app/api/edit-requests/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when requestDescription is whitespace only', async () => {
    const { POST } = await import('@/app/api/edit-requests/route');
    const res = await POST(makeRequest({ requestDescription: '   ' }));
    expect(res.status).toBe(400);
  });

  // ─── Rate limiting ─────────────────────────────────────────────────────────

  it('returns 429 when monthly edit limit (5) is reached', async () => {
    mockEditRequestsSelect.mockReturnValue(Promise.resolve({ count: 5, error: null }));
    const { POST } = await import('@/app/api/edit-requests/route');
    const res = await POST(makeRequest({ requestDescription: 'Update footer' }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/monthly edit limit/i);
  });

  it('allows requests when count is exactly 4 (one below limit)', async () => {
    mockEditRequestsSelect.mockReturnValue(Promise.resolve({ count: 4, error: null }));
    const { POST } = await import('@/app/api/edit-requests/route');
    const res = await POST(makeRequest({ requestDescription: 'Change phone number' }));
    expect(res.status).toBe(201);
  });

  // ─── DB error ──────────────────────────────────────────────────────────────

  it('returns 500 when insert fails', async () => {
    mockEditRequestsInsert.mockResolvedValueOnce({ error: { message: 'DB error' } });
    const { POST } = await import('@/app/api/edit-requests/route');
    const res = await POST(makeRequest({ requestDescription: 'Fix contact form' }));
    expect(res.status).toBe(500);
  });

  // ─── Happy path ────────────────────────────────────────────────────────────

  it('returns 201 with { ok: true } on success', async () => {
    const { POST } = await import('@/app/api/edit-requests/route');
    const res = await POST(makeRequest({ requestDescription: 'Update logo', targetPage: 'home' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('inserts with null business_id when no business found', async () => {
    mockBusinessesSelect.mockResolvedValueOnce({ data: null, error: null });
    const { POST } = await import('@/app/api/edit-requests/route');
    await POST(makeRequest({ requestDescription: 'Change colors' }));
    expect(mockEditRequestsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ business_id: null })
    );
  });
});
