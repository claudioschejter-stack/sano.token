import { describe, expect, it } from 'vitest';
import {
  RAILWAY_PRODUCTION_API,
  resolveBrowserApiBase,
  resolveBrowserNestOrigin,
  resolveFinanceStreamUrl,
  resolvePublicApiUrl
} from './resolvePublicApiUrl';

describe('resolvePublicApiUrl', () => {
  it('prefers NEXT_PUBLIC_API_URL', () => {
    expect(
      resolvePublicApiUrl({ NEXT_PUBLIC_API_URL: 'https://api.example.com/' } as NodeJS.ProcessEnv)
    ).toBe('https://api.example.com');
  });

  it('falls back to Railway on Vercel when unset', () => {
    expect(resolvePublicApiUrl({ VERCEL: '1' } as NodeJS.ProcessEnv)).toBe(RAILWAY_PRODUCTION_API);
  });

  it('uses localhost outside Vercel when unset', () => {
    expect(resolvePublicApiUrl({} as NodeJS.ProcessEnv)).toBe('http://localhost:4000');
  });
});

describe('resolveBrowserNestOrigin', () => {
  it('uses configured public URL in production', () => {
    expect(
      resolveBrowserNestOrigin({
        NEXT_PUBLIC_API_URL: 'https://sanovaapi-production.up.railway.app/',
        NODE_ENV: 'production'
      } as NodeJS.ProcessEnv)
    ).toBe(RAILWAY_PRODUCTION_API);
  });

  it('falls back to Railway in production when env missing', () => {
    expect(resolveBrowserNestOrigin({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(
      RAILWAY_PRODUCTION_API
    );
  });

  it('keeps localhost for local SSE via rewrite', () => {
    expect(
      resolveBrowserNestOrigin({
        NEXT_PUBLIC_API_URL: 'http://localhost:3001',
        NODE_ENV: 'development'
      } as NodeJS.ProcessEnv)
    ).toBe('http://localhost:3001');
  });

  it('ignores localhost in production builds (use Railway)', () => {
    expect(
      resolveBrowserNestOrigin({
        NEXT_PUBLIC_API_URL: 'http://localhost:3001',
        NODE_ENV: 'production'
      } as NodeJS.ProcessEnv)
    ).toBe(RAILWAY_PRODUCTION_API);
  });
});

describe('resolveFinanceStreamUrl', () => {
  it('builds absolute stream path', () => {
    expect(resolveFinanceStreamUrl({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(
      `${RAILWAY_PRODUCTION_API}/api/v1/finance/stream`
    );
  });
});

describe('resolveBrowserApiBase', () => {
  it('returns empty for same-origin rewrites when unset', () => {
    expect(resolveBrowserApiBase({} as NodeJS.ProcessEnv)).toBe('');
  });
});
