import { describe, expect, it } from 'vitest';
import { calculateMorphoSeedUsdc, resolveMorphoSeedUsdcForProject } from './morphoSeedLiquidity';

describe('morphoSeedLiquidity', () => {
  it('computes seed as totalTokens × price × LLTV with buffer', () => {
    // 10_000 tokens × $100 × 62.5% LLTV × 10% buffer = $687_500
    const seed = calculateMorphoSeedUsdc({
      totalTokens: 10_000,
      pricePerToken: 100,
      lltvBps: 6250,
      bufferBps: 1000
    });
    expect(seed).toBe(687_500);
  });

  it('returns zero for invalid inputs', () => {
    expect(calculateMorphoSeedUsdc({ totalTokens: 0, pricePerToken: 100 })).toBe(0);
    expect(calculateMorphoSeedUsdc({ totalTokens: 100, pricePerToken: 0 })).toBe(0);
  });

  it('uses manual env floor when configured above calculated amount', () => {
    const previous = process.env.MORPHO_SEED_LIQUIDITY_USDC;
    process.env.MORPHO_SEED_LIQUIDITY_USDC = '1000000';
    try {
      const seed = resolveMorphoSeedUsdcForProject({ totalTokens: 100, pricePerToken: 1 });
      expect(seed).toBe(1_000_000);
    } finally {
      if (previous === undefined) {
        delete process.env.MORPHO_SEED_LIQUIDITY_USDC;
      } else {
        process.env.MORPHO_SEED_LIQUIDITY_USDC = previous;
      }
    }
  });
});
