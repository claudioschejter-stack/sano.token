import { describe, expect, it, vi } from 'vitest';
import {
  detectDeviceLocale,
  mapBrowserLanguageToLocale,
  mapCountryToLocaleHint,
  resolveInitialLocale
} from './detectLocale';

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

  it('prefers stored locale when manually selected', () => {
    expect(
      resolveInitialLocale({
        stored: 'fr',
        countryHint: 'AR',
        browserLanguages: ['es'],
        manual: true
      })
    ).toBe('fr');
  });

  it('prefers country locale over incompatible stored preference', () => {
    expect(
      resolveInitialLocale({
        stored: 'sw',
        countryHint: 'AR',
        browserLanguages: ['es-AR']
      })
    ).toBe('es');
  });

  // The device language beats the IP hint: carriers in South America often
  // route through a neighbouring country and used to force the wrong language.
  it('prefers the browser language over the country hint', () => {
    expect(
      resolveInitialLocale({
        stored: null,
        countryHint: 'AR',
        browserLanguages: ['en-US']
      })
    ).toBe('en');
  });

  it('falls back to the country hint when no browser language matches', () => {
    expect(
      resolveInitialLocale({
        stored: null,
        countryHint: 'AR',
        browserLanguages: ['ko-KR']
      })
    ).toBe('es');
  });

  it('detects device locale from browser languages', () => {
    vi.stubGlobal('navigator', { languages: ['pt-BR'], language: 'pt-BR' });
    expect(detectDeviceLocale(null)).toBe('pt');
    vi.unstubAllGlobals();
  });
});
