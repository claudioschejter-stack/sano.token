import { describe, expect, it } from 'vitest';
import {
  PRIVY_FIAT_ONRAMP_BASE_CHAIN,
  privyFiatAssetForCountry,
  resolvePrivyFiatOnRampSource,
  shouldOfferPrivyOnRampForCountry
} from './privyOnRampPolicy';

describe('privyOnRampPolicy', () => {
  it('maps Argentina to ARS', () => {
    expect(privyFiatAssetForCountry('AR')).toBe('ars');
  });

  it('builds source assets with country default and global fallbacks', () => {
    expect(resolvePrivyFiatOnRampSource('AR')).toEqual({
      assets: ['ars', 'usd', 'eur'],
      defaultAsset: 'ars'
    });
    expect(resolvePrivyFiatOnRampSource('GB')).toEqual({
      assets: ['gbp', 'usd', 'eur'],
      defaultAsset: 'gbp'
    });
  });

  it('uses Base CAIP-2 chain id', () => {
    expect(PRIVY_FIAT_ONRAMP_BASE_CHAIN).toBe('eip155:8453');
  });

  it('offers Privy on-ramp in Argentina when Privy is configured', () => {
    process.env.DLOCAL_API_KEY = 'test';
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'privy-test';
    expect(shouldOfferPrivyOnRampForCountry('AR')).toBe(true);
    delete process.env.DLOCAL_API_KEY;
  });
});
