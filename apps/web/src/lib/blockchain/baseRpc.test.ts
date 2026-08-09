import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  alchemyBaseRpcUrl,
  baseRpcIsDedicated,
  describeBaseRpc,
  isPublicBaseRpc,
  resolveBaseMainnetRpcUrl,
  resolveBaseMainnetRpcUrls
} from './baseRpc';

const KEYS = [
  'LENDING_BASE_RPC_URL',
  'BASE_RPC_URL',
  'NEXT_PUBLIC_BASE_RPC_URL',
  'BLOCKCHAIN_RPC_URL',
  'ALCHEMY_BASE_RPC_URL',
  'ALCHEMY_API_KEY',
  'ALCHEMY_KEY',
  'NEXT_PUBLIC_ALCHEMY_KEY'
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('alchemyBaseRpcUrl', () => {
  it('builds the Base endpoint from a bare key', () => {
    process.env.ALCHEMY_API_KEY = 'abc123key';
    expect(alchemyBaseRpcUrl()).toBe('https://base-mainnet.g.alchemy.com/v2/abc123key');
  });

  it('prefers a full URL when one is given', () => {
    process.env.ALCHEMY_BASE_RPC_URL = 'https://base-mainnet.g.alchemy.com/v2/explicit';
    process.env.ALCHEMY_API_KEY = 'ignored';
    expect(alchemyBaseRpcUrl()).toBe('https://base-mainnet.g.alchemy.com/v2/explicit');
  });

  it('returns null with no Alchemy configuration', () => {
    expect(alchemyBaseRpcUrl()).toBeNull();
  });
});

describe('resolveBaseMainnetRpcUrls', () => {
  it('falls back to the public endpoint when nothing is configured', () => {
    expect(resolveBaseMainnetRpcUrl()).toBe('https://mainnet.base.org');
    expect(baseRpcIsDedicated()).toBe(false);
  });

  it('uses Alchemy before any public endpoint', () => {
    process.env.ALCHEMY_API_KEY = 'abc123key';
    const urls = resolveBaseMainnetRpcUrls();
    expect(urls[0]).toContain('alchemy.com');
    expect(baseRpcIsDedicated()).toBe(true);
  });

  it('keeps the public endpoints as failover behind the dedicated one', () => {
    process.env.ALCHEMY_API_KEY = 'abc123key';
    const urls = resolveBaseMainnetRpcUrls();
    expect(urls).toContain('https://mainnet.base.org');
    expect(urls.indexOf('https://mainnet.base.org')).toBeGreaterThan(0);
  });

  it('honours a dedicated endpoint under any of the accepted names', () => {
    for (const key of ['LENDING_BASE_RPC_URL', 'BASE_RPC_URL', 'NEXT_PUBLIC_BASE_RPC_URL'] as const) {
      for (const other of KEYS) delete process.env[other];
      process.env[key] = 'https://base.example.dedicated/rpc';
      expect(resolveBaseMainnetRpcUrl()).toBe('https://base.example.dedicated/rpc');
      expect(baseRpcIsDedicated()).toBe(true);
    }
  });

  it('does not repeat an endpoint configured twice', () => {
    process.env.BASE_RPC_URL = 'https://base.example.dedicated/rpc';
    process.env.LENDING_BASE_RPC_URL = 'https://base.example.dedicated/rpc';
    const urls = resolveBaseMainnetRpcUrls();
    expect(urls.filter((url) => url === 'https://base.example.dedicated/rpc')).toHaveLength(1);
  });
});

describe('isPublicBaseRpc', () => {
  it('treats an unset endpoint as public, because that is what it degrades to', () => {
    expect(isPublicBaseRpc(undefined)).toBe(true);
    expect(isPublicBaseRpc('https://mainnet.base.org')).toBe(true);
    expect(isPublicBaseRpc('https://base-mainnet.g.alchemy.com/v2/k')).toBe(false);
  });
});

describe('describeBaseRpc', () => {
  it('never echoes the provider key', () => {
    process.env.ALCHEMY_API_KEY = 'super-secret-key-value';
    const described = describeBaseRpc();
    expect(described.provider).toBe('alchemy');
    expect(described.dedicated).toBe(true);
    expect(described.url).not.toContain('super-secret-key-value');
    expect(described.url).toContain('***');
  });

  it('names the public endpoint so a degraded report is actionable', () => {
    const described = describeBaseRpc();
    expect(described.provider).toBe('public');
    expect(described.dedicated).toBe(false);
    expect(described.failoverCount).toBeGreaterThan(0);
  });
});
