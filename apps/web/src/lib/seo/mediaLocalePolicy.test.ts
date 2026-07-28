import { describe, expect, it } from 'vitest';
import {
  INDEXABLE_MEDIA_LOCALES,
  buildMediaAlternates,
  isIndexableMediaLocale,
  mediaContentLocale,
  mediaRobots
} from './mediaLocalePolicy';
import { getSiteUrl } from './siteUrl';

describe('mediaLocalePolicy', () => {
  it('indexes only es and en for shared media', () => {
    expect(INDEXABLE_MEDIA_LOCALES).toEqual(['es', 'en']);
    expect(isIndexableMediaLocale('es')).toBe(true);
    expect(isIndexableMediaLocale('en')).toBe(true);
    expect(isIndexableMediaLocale('fr')).toBe(false);
    expect(isIndexableMediaLocale('sw')).toBe(false);
  });

  it('canonicalizes non-indexable locales to Spanish', () => {
    const site = getSiteUrl();
    const alts = buildMediaAlternates('/videos/abc123', 'ja');
    expect(alts.canonical).toBe(`${site}/videos/abc123`);
    expect(alts.languages).toMatchObject({
      es: `${site}/videos/abc123`,
      en: `${site}/en/videos/abc123`,
      'x-default': `${site}/videos/abc123`
    });
    expect(mediaContentLocale('sw')).toBe('es');
    expect(mediaContentLocale('en')).toBe('en');
  });

  it('noindexes non-primary media locales', () => {
    expect(mediaRobots('es')).toMatchObject({ index: true });
    expect(mediaRobots('fr')).toMatchObject({ index: false, follow: true });
  });
});
