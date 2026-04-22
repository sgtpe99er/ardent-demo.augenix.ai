/**
 * Integration tests for /api/onboarding/save.
 *
 * Tests:
 * - Auth guard
 * - Schema validation (bad input → 400)
 * - step1 data persisted to businesses table
 * - step2 data persisted to brand_assets table
 * - step3 data persisted to businesses table
 * - step4 domain data persisted to domain_requests + businesses tables
 * - industry "other" resolved to industryOther value
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock external modules ────────────────────────────────────────────────────

const mockGetSession = vi.fn();
vi.mock('@/features/account/controllers/get-session', () => ({
  getSession: mockGetSession,
}));

// We track upsert/update calls on each table
const mockBusinessesUpsert = vi.fn().mockResolvedValue({ error: null });
const mockBusinessesUpdate = vi.fn().mockResolvedValue({ error: null });
const mockBrandAssetsUpsert = vi.fn().mockResolvedValue({ error: null });
const mockDomainRequestsUpsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/libs/supabase/supabase-server-client', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === aa_demo_businesses) {
        return {
          upsert: mockBusinessesUpsert,
          update: vi.fn().mockReturnValue({ eq: mockBusinessesUpdate }),
        };
      }
      if (table === aa_demo_brand_assets) {
        return { upsert: mockBrandAssetsUpsert };
      }
      if (table === aa_demo_domain_requests) {
        return { upsert: mockDomainRequestsUpsert };
      }
      return { upsert: vi.fn().mockResolvedValue({ error: null }) };
    }),
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/onboarding/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const step1 = {
  businessName: 'Acme Plumbing',
  industry: 'construction',
  locationCity: 'Austin',
  locationState: 'TX',
  locationCountry: 'US',
};

const step2 = {
  hasExistingWebsite: false,
  hasExistingLogo: false,
  hasBusinessCard: false,
  hasFacebookPage: false,
  stylePreference: 'modern',
  hasBrandColors: false,
  brandColors: [],
  colorPreference: 'blue',
  hasBrandFonts: false,
  brandFonts: [],
  fontPreference: '',
};

const step3 = {
  targetAudience: 'Homeowners',
  servicesProducts: 'Plumbing, Electrical',
  websiteFeatures: ['contact_form', 'services_page'],
};

const step4 = {
  needsDomain: true,
  requestedDomain: 'acmeplumbing.com',
  domainPrice: 22,
  selectedDomain: 'acmeplumbing.com',
  selectedDomainOurPrice: 22,
  selectedDomainVercelPrice: 15,
  registrantContact: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@acme.com',
    phone: '5551234567',
    address1: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    country: 'US',
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/onboarding/save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockBusinessesUpsert.mockResolvedValue({ error: null });
    mockBrandAssetsUpsert.mockResolvedValue({ error: null });
    mockDomainRequestsUpsert.mockResolvedValue({ error: null });
    mockBusinessesUpdate.mockResolvedValue({ error: null });
  });

  // ─── Auth guard ────────────────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/onboarding/save/route');
    const res = await POST(makeRequest({ step1 }));
    expect(res.status).toBe(401);
  });

  // ─── Schema validation ─────────────────────────────────────────────────────

  it('returns 400 when step1.businessName is empty', async () => {
    const { POST } = await import('@/app/api/onboarding/save/route');
    const res = await POST(makeRequest({ step1: { ...step1, businessName: '' } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when step3.targetAudience is empty', async () => {
    const { POST } = await import('@/app/api/onboarding/save/route');
    const res = await POST(makeRequest({ step3: { ...step3, targetAudience: '' } }));
    expect(res.status).toBe(400);
  });

  // ─── Step 1: businesses upsert ─────────────────────────────────────────────

  it('upserts businesses with step1 data', async () => {
    const { POST } = await import('@/app/api/onboarding/save/route');
    const res = await POST(makeRequest({ step1 }));
    expect(res.status).toBe(200);
    expect(mockBusinessesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Acme Plumbing',
        industry: 'construction',
        location_city: 'Austin',
        location_state: 'TX',
        location_country: 'US',
      }),
      expect.any(Object)
    );
  });

  it('resolves industry to industryOther when industry is "other"', async () => {
    const { POST } = await import('@/app/api/onboarding/save/route');
    await POST(makeRequest({ step1: { ...step1, industry: 'other', industryOther: 'Landscaping' } }));
    expect(mockBusinessesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ industry: 'Landscaping' }),
      expect.any(Object)
    );
  });

  // ─── Step 2: brand_assets upsert ───────────────────────────────────────────

  it('upserts brand_assets with step2 data', async () => {
    const { POST } = await import('@/app/api/onboarding/save/route');
    const res = await POST(makeRequest({ step2 }));
    expect(res.status).toBe(200);
    expect(mockBrandAssetsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        style_preference: 'modern',
        has_existing_logo: false,
        color_preference: 'blue',
      }),
      expect.any(Object)
    );
  });

  // ─── Step 3: businesses upsert ─────────────────────────────────────────────

  it('upserts businesses with step3 data', async () => {
    const { POST } = await import('@/app/api/onboarding/save/route');
    await POST(makeRequest({ step3 }));
    expect(mockBusinessesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        target_audience: 'Homeowners',
        services_products: 'Plumbing, Electrical',
        website_features: ['contact_form', 'services_page'],
      }),
      expect.any(Object)
    );
  });

  // ─── Step 4: domain_requests + businesses update ───────────────────────────

  it('upserts domain_requests and updates businesses with step4 data', async () => {
    const { POST } = await import('@/app/api/onboarding/save/route');
    const res = await POST(makeRequest({ step4 }));
    expect(res.status).toBe(200);
    expect(mockDomainRequestsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        needs_domain: true,
        requested_domain: 'acmeplumbing.com',
      }),
      expect.any(Object)
    );
    // businesses.update should be called to persist registrant contact + domain_name
    expect(mockBusinessesUpdate).toHaveBeenCalled();
  });

  it('returns 200 with { ok: true } on success', async () => {
    const { POST } = await import('@/app/api/onboarding/save/route');
    const res = await POST(makeRequest({ step1, step2, step3 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('returns 500 when businesses upsert fails', async () => {
    mockBusinessesUpsert.mockResolvedValueOnce({ error: { message: 'DB error' } });
    const { POST } = await import('@/app/api/onboarding/save/route');
    const res = await POST(makeRequest({ step1 }));
    expect(res.status).toBe(500);
  });
});
