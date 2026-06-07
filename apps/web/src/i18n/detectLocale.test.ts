import { describe, expect, it } from 'vitest';
import { mapBrowserLanguageToLocale, mapCountryToLocaleHint, resolveInitialLocale } from './detectLocale';

describe('detectLocale', () => {
  it('maps browser languages to supported locales', () => {
    expect(mapBrowserLanguageToLocale('pt-BR')).toBe('pt');
    expect(mapBrowserLanguageToLocale('en-US')).toBe('en');
    expect(mapBrowserLanguageToLocale('es-AR')).toBe('es');
  });

  it('uses country only as hint', () => {
    expect(mapCountryToLocaleHint('BR')).toBe('pt');
    expect(mapCountryToLocaleHint('AR')).toBe('es');
  });

  it('prefers stored locale over browser and country', () => {
    expect(
      resolveInitialLocale({
        stored: 'fr',
        countryHint: 'AR',
        browserLanguages: ['es']
      })
    ).toBe('fr');
  });

  it('prefers browser language over country hint', () => {
    expect(
      resolveInitialLocale({
        stored: null,
        countryHint: 'AR',
        browserLanguages: ['en-US']
      })
    ).toBe('en');
  });
});
