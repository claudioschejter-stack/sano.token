export function passkeyRpId(): string {
  const explicit = process.env.WEBAUTHN_RP_ID?.trim();
  if (explicit) {
    return explicit;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (siteUrl) {
    try {
      return new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname;
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
    return explicit.replace(/\/$/, '');
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return siteUrl.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}
