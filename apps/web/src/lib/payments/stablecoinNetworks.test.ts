import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getStablecoinNetwork decimals', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults USDC to 6 decimals', async () => {
    const { getStablecoinNetwork } = await import('./stablecoinNetworks');
    expect(getStablecoinNetwork('BASE').decimals).toBe(6);
  });

  it('ignores a blank USDC_DECIMALS instead of treating it as 0', async () => {
    vi.stubEnv('USDC_DECIMALS', '');
    vi.stubEnv('BASE_USDC_DECIMALS', '');
    vi.resetModules();
    const { getStablecoinNetwork } = await import('./stablecoinNetworks');
    expect(getStablecoinNetwork('BASE').decimals).toBe(6);
  });

  it('honours an explicit override', async () => {
    vi.stubEnv('BASE_USDC_DECIMALS', '8');
    vi.resetModules();
    const { getStablecoinNetwork } = await import('./stablecoinNetworks');
    expect(getStablecoinNetwork('BASE').decimals).toBe(8);
  });

  it('falls back when the value is not a number', async () => {
    vi.stubEnv('BASE_USDC_DECIMALS', 'six');
    vi.resetModules();
    const { getStablecoinNetwork } = await import('./stablecoinNetworks');
    expect(getStablecoinNetwork('BASE').decimals).toBe(6);
  });
});
