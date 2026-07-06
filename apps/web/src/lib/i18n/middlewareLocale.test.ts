import { describe, expect, it } from 'vitest';
import { resolveGeoLocale } from './geoLocale';
import { resolveGeoLocaleForMiddleware } from './middlewareLocale';

describe('middlewareLocale parity with geoLocale', () => {
  it('matches geoLocale for manual stored locale', () => {
    const input = {
      stored: 'en',
      countryHint: 'AR',
      browserLanguages: ['es-AR'],
      manual: true
    };
    expect(resolveGeoLocaleForMiddleware(input)).toBe(resolveGeoLocale(input));
  });

  it('prefers browser language over country hint', () => {
    const input = {
      stored: null,
      countryHint: 'AR',
      browserLanguages: ['en-US', 'es'],
      manual: false
    };
    expect(resolveGeoLocaleForMiddleware(input)).toBe('en');
    expect(resolveGeoLocaleForMiddleware(input)).toBe(resolveGeoLocale(input));
  });

  it('falls back to country hint when no browser languages', () => {
    const input = {
      stored: null,
      countryHint: 'BR',
      browserLanguages: [],
      manual: false
    };
    expect(resolveGeoLocaleForMiddleware(input)).toBe('pt');
    expect(resolveGeoLocaleForMiddleware(input)).toBe(resolveGeoLocale(input));
  });

  it('defaults to es when no signals', () => {
    const input = {
      stored: null,
      countryHint: null,
      browserLanguages: [],
      manual: false
    };
    expect(resolveGeoLocaleForMiddleware(input)).toBe('es');
    expect(resolveGeoLocaleForMiddleware(input)).toBe(resolveGeoLocale(input));
  });
});
