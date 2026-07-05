import { describe, expect, it } from 'vitest';
import {
  isLocaleCompatibleWithCountry,
  localeForCountry,
  resolveGeoLocale
} from './geoLocale';

describe('geoLocale', () => {
  it('prefers the device/browser language over a stale stored preference', () => {
    expect(
      resolveGeoLocale({
        stored: 'sw',
        countryHint: 'AR',
        browserLanguages: ['es-AR'],
        manual: false
      })
    ).toBe('es');
  });

  it('keeps the browser language even when the IP-derived country is misdetected (AR mobile carrier resolving as BR)', () => {
    expect(
      resolveGeoLocale({
        stored: null,
        countryHint: 'BR',
        browserLanguages: ['es-AR', 'es'],
        manual: false
      })
    ).toBe('es');
  });

  it('falls back to the country hint only when there is no usable browser language', () => {
    expect(
      resolveGeoLocale({
        stored: null,
        countryHint: 'BR',
        browserLanguages: [],
        manual: false
      })
    ).toBe('pt');
  });

  it('keeps a manual locale choice regardless of browser or country signals', () => {
    expect(
      resolveGeoLocale({
        stored: 'en',
        countryHint: 'AR',
        browserLanguages: ['es-AR'],
        manual: true
      })
    ).toBe('en');
  });

  it('marks Swahili as incompatible with Argentina', () => {
    expect(isLocaleCompatibleWithCountry('sw', 'AR')).toBe(false);
    expect(isLocaleCompatibleWithCountry('es', 'AR')).toBe(true);
  });

  it('maps payment country to locale', () => {
    expect(localeForCountry('AR')).toBe('es');
    expect(localeForCountry('BR')).toBe('pt');
  });
});
