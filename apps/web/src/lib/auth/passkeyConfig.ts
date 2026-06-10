export type PasskeyWebContext = {
  origin: string;
  rpId: string;
};

const SANOVA_RP_ID = 'sanovacapital.com';

const ALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  'www.sanovacapital.com',
  'sanovacapital.com',
  'sano-token-web.vercel.app'
]);

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, '');
}

export function passkeyRpId(): string {
  const explicit = process.env.WEBAUTHN_RP_ID?.trim();
  if (explicit) {
    return explicit;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (siteUrl) {
    try {
      const hostname = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname;
      return rpIdForHostname(hostname);
    } catch {
      return 'localhost';
    }
  }

  return 'localhost';
}

export function passkeyRpName(): string {
  return process.env.WEBAUTHN_RP_NAME?.trim() || 'Sanova Global RWA';
}

export function passkeyOrigin(): string {
  const explicit = process.env.WEBAUTHN_ORIGIN?.trim();
  if (explicit) {
    return normalizeOrigin(explicit);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return normalizeOrigin(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

function hostnameFromRequest(request: Request): string | null {
  const originHeader = request.headers.get('origin');
  if (originHeader) {
    try {
      return new URL(originHeader).hostname;
    } catch {
      /* ignore */
    }
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {
      /* ignore */
    }
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) {
    return host.split(',')[0]?.trim().split(':')[0] ?? null;
  }

  return null;
}

function originFromRequest(request: Request): string | null {
  const originHeader = request.headers.get('origin');
  if (originHeader) {
    try {
      return normalizeOrigin(new URL(originHeader).origin);
    } catch {
      /* ignore */
    }
  }

  const hostname = hostnameFromRequest(request);
  if (!hostname) {
    return null;
  }

  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https';
  return `${proto}://${hostname}`;
}

export function rpIdForHostname(hostname: string): string {
  const explicit = process.env.WEBAUTHN_RP_ID?.trim();
  if (explicit) {
    return explicit;
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1') {
    return 'localhost';
  }

  if (hostname === SANOVA_RP_ID || hostname.endsWith(`.${SANOVA_RP_ID}`)) {
    return SANOVA_RP_ID;
  }

  return hostname;
}

function isAllowedHostname(hostname: string): boolean {
  if (ALLOWED_HOSTNAMES.has(hostname)) {
    return true;
  }

  if (hostname.endsWith('.vercel.app')) {
    return true;
  }

  return false;
}

export function resolvePasskeyWebContext(request?: Request): PasskeyWebContext {
  if (request) {
    const origin = originFromRequest(request);
    const hostname = hostnameFromRequest(request);
    if (origin && hostname && isAllowedHostname(hostname)) {
      return {
        origin,
        rpId: rpIdForHostname(hostname)
      };
    }
  }

  return {
    origin: passkeyOrigin(),
    rpId: passkeyRpId()
  };
}

export function resolvePasskeyWebContextFromClientOrigin(clientOrigin: string): PasskeyWebContext {
  const origin = normalizeOrigin(clientOrigin);
  const hostname = new URL(origin).hostname;

  if (!isAllowedHostname(hostname)) {
    throw new Error('PASSKEY_ORIGIN_NOT_ALLOWED');
  }

  return {
    origin,
    rpId: rpIdForHostname(hostname)
  };
}
