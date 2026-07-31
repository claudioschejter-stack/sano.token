import { afterEach, describe, expect, it } from 'vitest';
import {
  buildDefaultMorphoMarketParams,
  isMorphoMarketId,
  resolveMorphoLltvBps,
  resolveMorphoMarketId,
  type MorphoMarketParams
} from './morphoBorrow';

const sampleParams: MorphoMarketParams = {
  loanToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  collateralToken: '0x125782B1302be9a2f58849f8A86F25F78009b367',
  oracle: '0x81bc0d8e0207E140b3101EB8Ffd2C387bD30AAEa',
  irm: '0x46415998764C29aB2a25CbeA6254146D50D22687',
  lltv: 6250n * 10n ** 14n
};

describe('resolveMorphoMarketId', () => {
  it('prefers registered externalId over recomputed defaults', () => {
    const externalId = '0xacc94a3f8cf6c3bd4060d02a2888027540db4a147dc2d7249472b1623d102209';
    expect(resolveMorphoMarketId({ externalId }, sampleParams)).toBe(externalId);
  });

  it('falls back to keccak params when externalId missing', () => {
    const id = resolveMorphoMarketId({ externalId: null }, sampleParams);
    expect(isMorphoMarketId(id)).toBe(true);
  });
});

describe('resolveMorphoLltvBps', () => {
  const previous = process.env.MORPHO_DEFAULT_LLTV_BPS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.MORPHO_DEFAULT_LLTV_BPS;
    } else {
      process.env.MORPHO_DEFAULT_LLTV_BPS = previous;
    }
  });

  it('ignores non-numeric env values and uses chain default', () => {
    process.env.MORPHO_DEFAULT_LLTV_BPS = '[SENSITIVE]';
    expect(resolveMorphoLltvBps(6250)).toBe(6250);
  });

  it('accepts valid env override', () => {
    process.env.MORPHO_DEFAULT_LLTV_BPS = '7700';
    expect(resolveMorphoLltvBps(6250)).toBe(7700);
  });
});

describe('buildDefaultMorphoMarketParams', () => {
  const previous = process.env.MORPHO_DEFAULT_LLTV_BPS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.MORPHO_DEFAULT_LLTV_BPS;
    } else {
      process.env.MORPHO_DEFAULT_LLTV_BPS = previous;
    }
  });

  it('does not collapse invalid LLTV env to 6000 bps', () => {
    process.env.MORPHO_DEFAULT_LLTV_BPS = '[SENSITIVE]';
    const params = buildDefaultMorphoMarketParams(
      '0x125782B1302be9a2f58849f8A86F25F78009b367',
      '0x81bc0d8e0207E140b3101EB8Ffd2C387bD30AAEa'
    );
    expect(params?.lltv).toBe(6250n * 10n ** 14n);
  });
});
