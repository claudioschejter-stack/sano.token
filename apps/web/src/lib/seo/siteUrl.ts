import { LEGAL_SITE_URL } from '../legal/legalConfig';

/** Canonical production origin (no trailing slash). */
export function getSiteUrl(): string {
  const raw = LEGAL_SITE_URL.trim().replace(/\/$/, '');
  if (raw.includes('sano-token-web.vercel.app')) {
    return 'https://www.sanovacapital.com';
  }
  return raw;
}

export const PUBLIC_MARKETING_PATHS = [
  '/',
  '/acceso',
  '/acceso/registro',
  '/contacto',
  '/privacidad',
  '/terminos'
] as const;
