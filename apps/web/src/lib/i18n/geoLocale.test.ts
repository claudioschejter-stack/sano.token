import { describe, expect, it } from 'vitest';
import {
  isLocaleCompatibleWithCountry,
  localeForCountry,
  resolveGeoLocale
} from './geoLocale';

describe('geoLocale', () => {
  it('forces Spanish for Argentina even when a stale Swahili preference exists', () => {
    expect(
      resolveGeoLocale({
        stored: 'sw',
        countryHint: 'AR',
        browserLanguages: ['sw-KE'],
        manual: false
      })
    ).toBe('es');
  });

  it('keeps a manual locale choice', () => {
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
