// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('gofresh_session')?.value;
  const { pathname } = req.nextUrl;

  // If token is missing and they aren't on the root page, redirect to home
  if (!token && pathname !== '/') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Prevent logged-in managers from looping back on the root page if desired
  // (Optional: change to '/' to allow them to search records too)
  if (token && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

// Fixed Matcher Configuration Block
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (Bypass all backend server endpoints) 👈 CRITICAL FIX
     * - _next/static & _next/image (Next.js assets)
     * - favicon.ico
     * - Image formats (jpg, jpeg, png, gif, svg, webp)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp)$).*)',
  ],
};