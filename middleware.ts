// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('gofresh_session')?.value;
  const { pathname } = req.nextUrl;

  // 1. If token is absent and target is not the landing page, reroute to home portal search view
  if (!token && pathname !== '/') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 2. If token exists and user hits the root landing page, let them remain on the search portal
  // (Or change to '/dashboard' if you want logged-in managers to automatically skip the search screen)
  if (token && pathname === '/dashboard-redirect-stub') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

// Optimized Matcher rules to protect all internal layers while keeping images open
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth/login (allow authentication requests through)
     * - Physical image formats (jpg, jpeg, png, gif, svg, webp) 👈 CRITICAL FIXED PATTERN
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth/login|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp)$).*)',
  ],
};