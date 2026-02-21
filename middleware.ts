import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from './lib/rate-limiter';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply security headers to all responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return response;
  }

  // Use session cookie as primary rate limit key (harder to spoof than IP headers).
  // Fall back to x-real-ip (set by reverse proxies), then connection IP.
  const sessionId = request.cookies.get('db-session')?.value;
  const ip = request.headers.get('x-real-ip') || request.ip || '0.0.0.0';
  const rateLimitKey = sessionId || ip;

  const { allowed, retryAfter } = checkRateLimit(rateLimitKey, request.nextUrl.pathname);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          ...SECURITY_HEADERS,
          'Retry-After': String(retryAfter || 60),
        },
      }
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
