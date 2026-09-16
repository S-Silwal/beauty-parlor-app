// proxy.ts — place at root of frontend project (same level as app/)
// Renamed from middleware.ts: Next.js 16 deprecated the `middleware` file
// convention in favor of `proxy` (same file conventions/APIs, function
// renamed from `middleware` to `proxy`) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// NOTE: Next.js proxy runs on the Edge and CANNOT read localStorage.
// Token must be stored in a cookie for proxy to work.
//
// ⚠️  TRUST BOUNDARY — READ BEFORE RELYING ON THIS FOR ANYTHING SECURITY-
// SENSITIVE (H10 in PRODUCTION_READINESS_AUDIT.md):
// decodeJwt() below only base64-decodes the token payload — it does NOT
// verify the JWT signature, because Edge proxy has no access to
// JWT_SECRET (and verifying it here wouldn't be meaningfully safer even if
// it did — Edge Proxy still isn't where authorization belongs). That
// means the `role` this file reads is whatever the payload CLAIMS, not
// something cryptographically proven. A hand-edited cookie with
// `role: "ADMIN"` sails right past the checks below and into the /admin
// route tree.
//
// This is fine ONLY because every route here is UI-shell routing —
// deciding which page shell to render, nothing more. It is NOT, and must
// never become, the thing that actually gates access to admin data or
// actions. Every real admin endpoint re-verifies the JWT signature and role
// server-side (see backend/src/middleware/auth.middleware.ts and
// role.middleware.ts) — that's the actual authorization boundary. Treat
// what happens in this file as decorative: it exists so a logged-out
// visitor doesn't briefly see an admin page shell flash before data loads,
// not to keep anyone out of anything real.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_ROUTES     = ['/admin'];
const CUSTOMER_ROUTES  = ['/dashboard'];
const PROTECTED_ROUTES = ['/booking', '/my-bookings'];
const AUTH_ROUTES      = ['/login', '/register'];

function decodeJwt(token: string): { role?: string; exp?: number } | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const padded = base64.replace(/-/g, '+').replace(/_/g, '/');
    const json   = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isExpired(payload: { exp?: number }): boolean {
  if (!payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')   ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('accessToken')?.value;

  let role: string | null = null;
  let isLoggedIn = false;

  if (token) {
    const payload = decodeJwt(token);
    if (payload && !isExpired(payload)) {
      role = payload.role ?? null;
      isLoggedIn = true;
    }
  }

  if (isLoggedIn && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(
      new URL(role === 'ADMIN' ? '/admin' : '/dashboard', request.url)
    );
  }

  if (ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    if (!isLoggedIn) {
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    if (role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (CUSTOMER_ROUTES.some(r => pathname.startsWith(r))) {
    if (!isLoggedIn) {
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    if (role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  if (PROTECTED_ROUTES.some(r => pathname.startsWith(r))) {
    if (!isLoggedIn) {
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
