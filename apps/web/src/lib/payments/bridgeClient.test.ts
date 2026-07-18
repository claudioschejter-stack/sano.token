import { describe, expect, it } from 'vitest';
import {
  bridgeSourceCurrencyForCountry,
  isBridgeWireCountry,
  settlementHintForRails
} from './bridgeClient';

describe('bridgeClient country mapping', () => {
  it('maps countries to VA source currencies', () => {
    expect(bridgeSourceCurrencyForCountry('US')).toBe('usd');
    expect(bridgeSourceCurrencyForCountry('EU')).toBe('eur');
    expect(bridgeSourceCurrencyForCountry('DE')).toBe('eur');
    expect(bridgeSourceCurrencyForCountry('MX')).toBe('mxn');
    expect(bridgeSourceCurrencyForCountry('BR')).toBe('brl');
    expect(bridgeSourceCurrencyForCountry('GB')).toBe('gbp');
  });

  it('keeps Argentina off Bridge wire', () => {
    expect(isBridgeWireCountry('AR')).toBe(false);
    expect(isBridgeWireCountry('US')).toBe(true);
    expect(isBridgeWireCountry('BR')).toBe(true);
    expect(isBridgeWireCountry('MX')).toBe(true);
  });

  it('returns rail-specific settlement hints', () => {
    expect(settlementHintForRails(['pix'], 'BRL')).toMatch(/Pix/i);
    expect(settlementHintForRails(['sepa'], 'EUR')).toMatch(/SEPA/i);
    expect(settlementHintForRails(['spei'], 'MXN')).toMatch(/SPEI/i);
    expect(settlementHintForRails(['ach_push', 'wire'], 'USD')).toMatch(/ACH/i);
  });
});
