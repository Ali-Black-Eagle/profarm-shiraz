import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. CSRF Defense: Verify Origin, Sec-Fetch-Site, and Referer on state-changing API methods
  const method = request.method.toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    const secFetchSite = request.headers.get('sec-fetch-site');
    const referer = request.headers.get('referer');

    // 0.0 SECURITY: a state-changing API call that carries no Origin, Referer or Fetch Metadata
    // did not come from a browser page. Reject it. The payment callback and webhooks are exempt.
    const csrfExempt = pathname === '/api/payment/verify' || pathname.includes('/webhook');
    if (!csrfExempt && !origin && !referer && !secFetchSite) {
      return NextResponse.json(
        { success: false, message: 'درخواست نامعتبر است: منبع درخواست مشخص نیست (CSRF).' },
        { status: 403 }
      );
    }

    // 0.1 Block any cross-site request detected via modern W3C Fetch Metadata
    if (secFetchSite === 'cross-site') {
      return NextResponse.json(
        { success: false, message: 'Cross-Site Request Forgery (CSRF) blocked by Sec-Fetch-Site.' },
        { status: 403 }
      );
    }

    // 0.2 Check Origin if present
    if (origin && host) {
      try {
        const url = new URL(origin);
        const originHost = url.host;
        const originHostname = url.hostname;
        const requestHostname = host.split(':')[0];

        const isLocalDev =
          (originHostname === 'localhost' || originHostname === '127.0.0.1') &&
          (requestHostname === 'localhost' || requestHostname === '127.0.0.1');

        if (originHost !== host && !isLocalDev) {
          return NextResponse.json(
            { success: false, message: 'Cross-Site Request Forgery (CSRF) blocked.' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, message: 'Invalid origin header.' },
          { status: 403 }
        );
      }
    } else if (referer && host) {
      // 0.3 Fallback: Check Referer header if Origin is absent
      try {
        const refUrl = new URL(referer);
        const refHost = refUrl.host;
        const refHostname = refUrl.hostname;
        const requestHostname = host.split(':')[0];

        const isLocalDev =
          (refHostname === 'localhost' || refHostname === '127.0.0.1') &&
          (requestHostname === 'localhost' || requestHostname === '127.0.0.1');

        if (refHost !== host && !isLocalDev) {
          return NextResponse.json(
            { success: false, message: 'Cross-Site Request Forgery (CSRF) blocked by Referer check.' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, message: 'Invalid referer header.' },
          { status: 403 }
        );
      }
    }
  }

  // 1. Check API Admin Routes
  if (pathname.startsWith('/api/admin')) {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: 'دسترسی غیرمجاز: لطفا ابتدا وارد حساب مدیر شوید.',
        },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          message: 'دسترسی ممنوع: فقط مدیر ارشد سیستم مجاز به تغییر این بخش است.',
        },
        { status: 403 }
      );
    }

    return NextResponse.next();
  }

  // 2. Check Admin Page Routes
  if (pathname.startsWith('/admin')) {
    // If someone attempts to access /admin/login, redirect them directly to the unified /login
    if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', '/admin');
      return NextResponse.redirect(loginUrl);
    }

    const session = getSessionFromRequest(request);

    if (!session || session.role !== 'ADMIN') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('reason', 'admin_required');
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
