import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { hasAdminAccess } from './lib/admin-access';
import { ADMIN_SESSION_COOKIE, parseAdminSessionCookie } from './lib/admin-session-cookie';

const dashboardPath = '/dashboard';
const loginPath = '/login';

function isAssetPath(pathname: string) {
  return pathname.startsWith('/_next') || /\/[^/]+\.[^/]+$/.test(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname, basePath } = request.nextUrl;

  if (isAssetPath(pathname)) {
    return NextResponse.next();
  }

  const role = parseAdminSessionCookie(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  const hasAccess = Boolean(role && hasAdminAccess(role));
  const appBasePath = basePath || '';

  if (pathname === '/') {
    return NextResponse.redirect(new URL(`${appBasePath}${hasAccess ? dashboardPath : loginPath}`, request.url));
  }

  if (pathname === loginPath) {
    if (hasAccess) {
      return NextResponse.redirect(new URL(`${appBasePath}${dashboardPath}`, request.url));
    }

    return NextResponse.next();
  }

  if (!hasAccess) {
    return NextResponse.redirect(new URL(`${appBasePath}${loginPath}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*']
};
