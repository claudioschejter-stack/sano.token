/** Nest worker URL for rewrites and direct client calls. Empty = same-origin `/api/v1` (Vercel rewrite). */
export const RAILWAY_PRODUCTION_API = 'https://sanovaapi-production.up.railway.app';

export function resolvePublicApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.NEXT_PUBLIC_API_URL?.trim() || env.NEST_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (env.VERCEL === '1') {
    return RAILWAY_PRODUCTION_API;
  }
  return 'http://localhost:4000';
}

/** Browser client base: empty string uses same-origin `/api/v1` rewrites. */
export function resolveBrowserApiBase(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.NEXT_PUBLIC_API_URL?.trim();
  return configured ? configured.replace(/\/$/, '') : '';
}
