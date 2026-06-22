// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CRITICAL FIX: Renamed from 'proxy' to 'middleware' so Next.js hooks into it automatically
export function middleware(req: NextRequest) {
  // RECONCILIATION: Match this to the cookie name assigned during the login API sequence
  const token = req.cookies.get('gofresh_session')?.value;
  const { pathname } = req.nextUrl;

  // 1. If token is absent and target is not login page, reroute to terminal auth
  if (!token && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 2. If token exists and user hits login page, kick straight back into application metrics
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

// Optimized Matcher rules to protect all internal layers while keeping assets open
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth/login (allow authentication requests through unhindered)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth/login).*)',
  ],
};