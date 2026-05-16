// middleware.ts — place at root of frontend project (same level as app/)
// NOTE: Next.js middleware runs on the Edge and CANNOT read localStorage.
// Token must be stored in a cookie for middleware to work.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_ROUTES     = ['/admin'];
const CUSTOMER_ROUTES  = ['/dashboard'];
const PROTECTED_ROUTES = ['/booking'];
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

export function middleware(request: NextRequest) {
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