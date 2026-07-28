/** Nest worker URL for rewrites and direct client calls. */
export const RAILWAY_PRODUCTION_API = 'https://sanovaapi-production.up.railway.app';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function pickConfiguredApiUrl(env: NodeJS.ProcessEnv): string {
  const configured = env.NEXT_PUBLIC_API_URL?.trim() || env.NEST_PUBLIC_API_URL?.trim();
  return configured ? stripTrailingSlash(configured) : '';
}

/** Server/build rewrite target. Empty env on Vercel → Railway production Nest. */
export function resolvePublicApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = pickConfiguredApiUrl(env);
  if (configured) {
    return configured;
  }
  if (env.VERCEL === '1') {
    return RAILWAY_PRODUCTION_API;
  }
  return 'http://localhost:4000';
}

/**
 * Browser REST base: empty string uses same-origin `/api/v1` rewrites.
 * Prefer setting `NEXT_PUBLIC_API_URL` in Vercel so clients can call Nest directly when needed.
 */
export function resolveBrowserApiBase(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.NEXT_PUBLIC_API_URL?.trim();
  return configured ? stripTrailingSlash(configured) : '';
}

/**
 * Absolute Nest origin for browser SSE.
 * Production builds fall back to Railway so EventSource does not depend on Vercel proxy timeouts.
 */
export function resolveBrowserNestOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    const origin = stripTrailingSlash(configured);
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
    if (env.NODE_ENV !== 'production') {
      return origin;
    }
  }

  if (env.NODE_ENV === 'production') {
    return RAILWAY_PRODUCTION_API;
  }

  return '';
}

/** Full EventSource URL for dividend / finance SSE. */
export function resolveFinanceStreamUrl(env: NodeJS.ProcessEnv = process.env): string {
  const origin = resolveBrowserNestOrigin(env);
  return `${origin}/api/v1/finance/stream`;
}
