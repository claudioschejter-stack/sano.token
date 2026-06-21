import { describe, expect, it } from 'vitest';
import { buildMorphoMarketPoolUrl, buildSanovaBorrowPath, resolveMorphoMarketSlug } from './morphoMarketUrls';

describe('morphoMarketUrls', () => {
  it('uses known slug for Añelo NAV market', () => {
    expect(
      buildMorphoMarketPoolUrl(
        '0x114aee5443b74e9527c14fad35968a4fe98090941888fc8c8a88d4c33c3936e7'
      )
    ).toBe(
      'https://app.morpho.org/base/market/0x114aee5443b74e9527c14fad35968a4fe98090941888fc8c8a88d4c33c3936e7/vanelouv-usdc#market'
    );
  });

  it('uses known slug for UV3 market', () => {
    expect(
      buildMorphoMarketPoolUrl(
        '0xacc94a3f8cf6c3bd4060d02a2888027540db4a147dc2d7249472b1623d102209'
      )
    ).toBe(
      'https://app.morpho.org/base/market/0xacc94a3f8cf6c3bd4060d02a2888027540db4a147dc2d7249472b1623d102209/vuv3rwa-usdc#market'
    );
  });

  it('derives slug from token symbol when market is unknown', () => {
    expect(resolveMorphoMarketSlug('0xabc', 'UV3RWA')).toBe('vuv3rwa-usdc');
  });

  it('builds in-app borrow path', () => {
    expect(buildSanovaBorrowPath('proj-apart-hotel-urban-view-anelo-mplonxbv')).toBe(
      '/marketplace/proj-apart-hotel-urban-view-anelo-mplonxbv/prestamo'
    );
  });
});
