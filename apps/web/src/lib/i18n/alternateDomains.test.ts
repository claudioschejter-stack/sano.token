import { describe, expect, it } from 'vitest';
import { isAlternateMarketingHost, isMaskableOnAlternateHost } from './alternateDomains';

describe('isAlternateMarketingHost', () => {
  it('recognizes all 8 alternate domain/www variants', () => {
    expect(isAlternateMarketingHost('tokenvacamuerta.org')).toBe(true);
    expect(isAlternateMarketingHost('www.tokenvacamuerta.org')).toBe(true);
    expect(isAlternateMarketingHost('tokenvacamuerta.net')).toBe(true);
    expect(isAlternateMarketingHost('www.tokenvacamuerta.net')).toBe(true);
    expect(isAlternateMarketingHost('vacamuertatoken.org')).toBe(true);
    expect(isAlternateMarketingHost('www.vacamuertatoken.org')).toBe(true);
    expect(isAlternateMarketingHost('vacamuertatoken.net')).toBe(true);
    expect(isAlternateMarketingHost('www.vacamuertatoken.net')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAlternateMarketingHost('TokenVacaMuerta.ORG')).toBe(true);
  });

  it('rejects the canonical domain and unrelated hosts', () => {
    expect(isAlternateMarketingHost('www.sanovacapital.com')).toBe(false);
    expect(isAlternateMarketingHost('sanovacapital.com')).toBe(false);
    expect(isAlternateMarketingHost('evil.com')).toBe(false);
    expect(isAlternateMarketingHost(null)).toBe(false);
    expect(isAlternateMarketingHost(undefined)).toBe(false);
  });
});

describe('isMaskableOnAlternateHost', () => {
  it('allows public marketing pages, with and without locale prefix', () => {
    expect(isMaskableOnAlternateHost('/')).toBe(true);
    expect(isMaskableOnAlternateHost('/en')).toBe(true);
    expect(isMaskableOnAlternateHost('/nosotros')).toBe(true);
    expect(isMaskableOnAlternateHost('/en/faq')).toBe(true);
    expect(isMaskableOnAlternateHost('/blog')).toBe(true);
    expect(isMaskableOnAlternateHost('/blog/algun-articulo')).toBe(true);
    expect(isMaskableOnAlternateHost('/en/blog/some-article')).toBe(true);
    expect(isMaskableOnAlternateHost('/videos')).toBe(true);
    expect(isMaskableOnAlternateHost('/videos/kjPpMdFweAM')).toBe(true);
    expect(isMaskableOnAlternateHost('/robots.txt')).toBe(true);
    expect(isMaskableOnAlternateHost('/sitemap.xml')).toBe(true);
  });

  it('never masks session-bearing or protected routes', () => {
    expect(isMaskableOnAlternateHost('/dashboard')).toBe(false);
    expect(isMaskableOnAlternateHost('/marketplace')).toBe(false);
    expect(isMaskableOnAlternateHost('/mercado-secundario')).toBe(false);
    expect(isMaskableOnAlternateHost('/acceso')).toBe(false);
    expect(isMaskableOnAlternateHost('/en/acceso')).toBe(false);
    expect(isMaskableOnAlternateHost('/kyc')).toBe(false);
    expect(isMaskableOnAlternateHost('/api/anything')).toBe(false);
  });

  it('fails safe: redirects any unknown/future path by default', () => {
    expect(isMaskableOnAlternateHost('/some-new-route-nobody-added-to-the-allowlist')).toBe(false);
  });
});
