import { describe, expect, it } from 'vitest';
import { BLOG_SLUGS, hasNativeTranslation } from '../../content/blog/articles';
import { locales } from '../../i18n';
import { buildPublicSitemapUrls, getSiteUrl } from './siteUrl';

describe('buildPublicSitemapUrls', () => {
  it('includes Spanish and locale-prefixed marketing shells', () => {
    const urls = buildPublicSitemapUrls();
    const site = getSiteUrl();

    expect(urls).toContain(site);
    expect(urls).toContain(`${site}/blog`);
    expect(urls).toContain(`${site}/en/blog`);
    expect(urls).toContain(`${site}/ar/faq`);
    expect(urls).not.toContain(`${site}/acceso`);
    expect(urls).not.toContain(`${site}/privacidad`);
  });

  it('only lists blog article URLs for locales with native translations', () => {
    const urls = buildPublicSitemapUrls();
    const site = getSiteUrl();

    // Newer articles exist only in en + es — non-native locales must not appear.
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
});
