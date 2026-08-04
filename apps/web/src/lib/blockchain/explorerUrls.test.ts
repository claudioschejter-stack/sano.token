import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveChainId, resolveMorphoChainId } from './explorerUrls';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveChainId', () => {
  it('defaults to Base mainnet', () => {
    expect(resolveChainId()).toBe(8453);
  });

  it('ignores blank vars instead of returning NaN', () => {
    vi.stubEnv('TOKEN_DEPLOY_CHAIN_ID', '');
    vi.stubEnv('NEXT_PUBLIC_CHAIN_ID', '');
    expect(resolveChainId()).toBe(8453);
  });

  it('honours an explicit chain id', () => {
    vi.stubEnv('TOKEN_DEPLOY_CHAIN_ID', '84532');
    expect(resolveChainId()).toBe(84532);
  });

  it('falls back when the value is not numeric', () => {
    vi.stubEnv('TOKEN_DEPLOY_CHAIN_ID', 'base');
    expect(resolveChainId()).toBe(8453);
  });
});

describe('resolveMorphoChainId', () => {
  it('defaults to Base mainnet', () => {
    expect(resolveMorphoChainId()).toBe(8453);
  });

  it('ignores blank vars instead of returning NaN', () => {
    vi.stubEnv('MORPHO_CHAIN_ID', '');
    vi.stubEnv('LENDING_CHAIN_ID', '');
    vi.stubEnv('TOKEN_DEPLOY_CHAIN_ID', '');
    expect(resolveMorphoChainId()).toBe(8453);
  });

  it('falls back when the value is not numeric', () => {
    vi.stubEnv('MORPHO_CHAIN_ID', 'base');
    expect(resolveMorphoChainId()).toBe(8453);
  });

  it('honours an explicit chain id', () => {
    vi.stubEnv('MORPHO_CHAIN_ID', '84532');
    expect(resolveMorphoChainId()).toBe(84532);
  });
});
