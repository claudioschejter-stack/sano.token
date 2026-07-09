import type { NextResponse } from 'next/server';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Didit hosted KYC (full-page redirect) needs camera/mic on a same-origin/top-level navigation. */
const DIDIT_MEDIA_ORIGINS = [
  'https://verify.didit.me',
  'https://verification.didit.me'
] as const;

export function pathNeedsKycCamera(pathname: string): boolean {
  return pathname === '/kyc' || pathname.startsWith('/kyc/');
}

function buildPermissionsPolicy(allowKycCamera: boolean): string {
  if (!allowKycCamera) {
    return 'camera=(), microphone=(), geolocation=(), payment=(self)';
  }

  const mediaOrigins = ['self', ...DIDIT_MEDIA_ORIGINS.map((origin) => `"${origin}"`)].join(' ');

  return `camera=(${mediaOrigins}), microphone=(${mediaOrigins}), geolocation=(), payment=(self)`;
}

export type SecurityHeaderOptions = {
  allowKycCamera?: boolean;
};

/**
 * Apply HTTP security headers on every HTML/navigation response.
 * Real authorization and data integrity remain server-side (API routes + auth).
 */
export function applySecurityHeaders(
  response: NextResponse,
  options?: SecurityHeaderOptions
): NextResponse {
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set(
    'Permissions-Policy',
    buildPermissionsPolicy(Boolean(options?.allowKycCamera))
  );
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site');

  if (IS_PRODUCTION) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // Limit embedding / base tag hijacking; allow known payment & wallet flows via https.
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self' https://checkout.stripe.com https://commerce.coinbase.com https://www.mercadopago.com https://www.mercadopago.com.ar https://global.transak.com https://pay.google.com https://www.paypal.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https:"
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}
