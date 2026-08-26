import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, api routes, and public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
