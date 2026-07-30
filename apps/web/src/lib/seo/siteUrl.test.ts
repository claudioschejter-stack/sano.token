import { describe, expect, it } from 'vitest';
import { BLOG_SLUGS, hasNativeTranslation } from '../../content/blog/articles';
import { locales } from '../../i18n';
import { buildPublicSitemapUrls, getSiteUrl, INDEXABLE_SHELL_LOCALES } from './siteUrl';

describe('buildPublicSitemapUrls', () => {
  it('limits marketing shells to es + en to protect crawl budget', () => {
    const urls = buildPublicSitemapUrls();
    const site = getSiteUrl();

    expect(INDEXABLE_SHELL_LOCALES).toEqual(['es', 'en']);
    expect(urls).toContain(site);
    expect(urls).toContain(`${site}/en`);
    expect(urls).toContain(`${site}/blog`);
    expect(urls).toContain(`${site}/en/blog`);
    expect(urls).toContain(`${site}/faq`);
    expect(urls).toContain(`${site}/en/faq`);
    expect(urls).toContain(`${site}/nosotros`);
    expect(urls).toContain(`${site}/privacidad`);
    expect(urls).toContain(`${site}/en/terminos`);

    // Secondary locales must not flood the sitemap with every shell.
    expect(urls).not.toContain(`${site}/ar/faq`);
    expect(urls).not.toContain(`${site}/ja/nosotros`);
    expect(urls).not.toContain(`${site}/zh/contacto`);
    expect(urls).not.toContain(`${site}/de/privacidad`);
    expect(urls).not.toContain(`${site}/acceso`);
  });

  it('adds secondary-locale /blog hubs only when native articles exist', () => {
    const urls = buildPublicSitemapUrls();
    const site = getSiteUrl();

    // ar has native articles for the first batch → blog hub is discoverable.
    expect(urls).toContain(`${site}/ar/blog`);
    // he has no blog catalog → no hub.
    expect(urls).not.toContain(`${site}/he/blog`);
  });

  it('only lists blog article URLs for locales with native translations', () => {
    const urls = buildPublicSitemapUrls();
    const site = getSiteUrl();

    expect(urls).toContain(`${site}/blog/kyc-inversion-cripto`);
    expect(urls).toContain(`${site}/en/blog/kyc-inversion-cripto`);
    expect(urls).not.toContain(`${site}/ar/blog/kyc-inversion-cripto`);
    expect(urls).not.toContain(`${site}/ja/blog/kyc-inversion-cripto`);
    expect(urls).not.toContain(`${site}/bn/blog/usdc-yield-real-estate`);
    expect(urls).not.toContain(`${site}/fr/blog/numeros-shale-argentina`);

    for (const slug of BLOG_SLUGS) {
      for (const locale of locales) {
        if (locale === 'es') {
          continue;
        }
        const url = `${site}/${locale}/blog/${slug}`;
        if (hasNativeTranslation(slug, locale)) {
          expect(urls).toContain(url);
        } else {
          expect(urls).not.toContain(url);
        }
      }
    }
  });

  it('stays well under the previous 200+ discovery flood', () => {
    const urls = buildPublicSitemapUrls();
    // Shells (7 paths × 2) + secondary blog hubs (~14) + native articles
    // (≤ 11×15) should stay comfortably below the old ~200 “discovered” pile.
    expect(urls.length).toBeLessThan(120);
    expect(urls.length).toBeGreaterThan(20);
  });
});
