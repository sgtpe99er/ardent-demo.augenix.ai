import { type NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { getEnvVar } from '@/utils/get-env-var';

// Support both new Publishable keys (sb_publishable_...) and legacy anon keys
function getPublishableKey(): string {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (publishableKey) return publishableKey;
  if (anonKey) return anonKey;
  
  throw new Error('Missing Supabase key: Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    getPublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          supabaseResponse = NextResponse.next({
            request,
          });

          // Optionally set cookies on a parent domain so subdomains can share
          // auth (e.g. for a cross-origin preview bar). Configure via
          // NEXT_PUBLIC_AUTH_COOKIE_DOMAIN (e.g. ".example.com"). When unset,
          // cookies are host-only, which is the correct default.
          const cookieDomain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
          const crossSite = Boolean(cookieDomain);

          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, {
              ...(options as Record<string, unknown>),
              ...(cookieDomain ? { domain: cookieDomain } : {}),
              ...(crossSite ? { sameSite: 'none' as const, secure: true } : {}),
            });
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect admin routes - check if user is admin
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Check if user is admin using the is_admin function
    const { data: isAdmin, error } = await supabase.rpc('is_admin', {
      user_uuid: user.id,
    });

    if (error || !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Protect dashboard routes - require authentication
  const protectedRoutes = ['/dashboard', '/onboarding', '/payment'];
  if (protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
