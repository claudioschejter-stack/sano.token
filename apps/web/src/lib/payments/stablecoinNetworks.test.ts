import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BASE_USDC_TOKEN_ADDRESS,
  baseRpcUrls,
  getStablecoinNetwork
} from './stablecoinNetworks';

describe('stablecoinNetworks Base defaults', () => {
  const previous = {
    BASE_USDC_TOKEN_ADDRESS: process.env.BASE_USDC_TOKEN_ADDRESS,
    USDC_TOKEN_ADDRESS: process.env.USDC_TOKEN_ADDRESS,
    NEXT_PUBLIC_BASE_USDC_ADDRESS: process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS,
    BASE_RPC_URL: process.env.BASE_RPC_URL,
    NEXT_PUBLIC_BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL,
    LENDING_BASE_RPC_URL: process.env.LENDING_BASE_RPC_URL
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults Base USDC token address when env is missing', () => {
    delete process.env.BASE_USDC_TOKEN_ADDRESS;
    delete process.env.USDC_TOKEN_ADDRESS;
    delete process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS;

    const network = getStablecoinNetwork('BASE');
    expect(network.tokenAddress?.toLowerCase()).toBe(DEFAULT_BASE_USDC_TOKEN_ADDRESS.toLowerCase());
  });

  it('exposes multiple Base RPC fallbacks', () => {
    delete process.env.BASE_RPC_URL;
    delete process.env.NEXT_PUBLIC_BASE_RPC_URL;
    delete process.env.LENDING_BASE_RPC_URL;

    const urls = baseRpcUrls();
    expect(urls.length).toBeGreaterThanOrEqual(2);
    expect(urls[0]).toContain('base');
  });
});
