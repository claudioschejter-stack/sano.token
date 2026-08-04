import { describe, expect, it } from 'vitest';
import { maskRpcUrl } from './maskRpcUrl';

describe('maskRpcUrl', () => {
  it('hides the key providers put in the path', () => {
    const masked = maskRpcUrl('https://base-mainnet.g.alchemy.com/v2/alch_SuperSecretKey123');
    expect(masked).toBe('https://base-mainnet.g.alchemy.com/v2/***');
    expect(masked).not.toContain('alch_SuperSecretKey123');
  });

  it('hides the key providers put in the query string', () => {
    const masked = maskRpcUrl('https://rpc.example.com/base?apikey=SuperSecretKey123');
    expect(masked).toContain('apikey=***');
    expect(masked).not.toContain('SuperSecretKey123');
  });

  it('leaves a keyless public endpoint readable', () => {
    expect(maskRpcUrl('https://mainnet.base.org')).toBe('https://mainnet.base.org/');
  });

  it('keeps short path segments that are structure, not secrets', () => {
    expect(maskRpcUrl('https://rpc.example.com/v1/rpc')).toBe('https://rpc.example.com/v1/rpc');
  });

  it('masks anything it cannot parse rather than echoing it', () => {
    expect(maskRpcUrl('not a url with a key in it')).toBe('***');
  });

  it('returns null for a missing url', () => {
    expect(maskRpcUrl(null)).toBeNull();
    expect(maskRpcUrl('   ')).toBeNull();
  });
});
