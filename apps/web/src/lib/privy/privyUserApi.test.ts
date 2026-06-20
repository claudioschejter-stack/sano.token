import { describe, expect, it } from 'vitest';
import { extractVerifiedPrivyEmails } from './privyUserApi';

describe('extractVerifiedPrivyEmails', () => {
  it('collects verified email linked accounts', () => {
    expect(
      extractVerifiedPrivyEmails([
        {
          type: 'email',
          address: 'Investor@Example.com',
          verified_at: 1
        }
      ])
    ).toEqual(['investor@example.com']);
  });

  it('ignores unverified linked accounts', () => {
    expect(
      extractVerifiedPrivyEmails([
        {
          type: 'email',
          address: 'investor@example.com'
        }
      ])
    ).toEqual([]);
  });

  it('includes oauth emails when verified', () => {
    expect(
      extractVerifiedPrivyEmails([
        {
          type: 'google_oauth',
          email: 'investor@example.com',
          latest_verified_at: 1
        }
      ])
    ).toEqual(['investor@example.com']);
  });
});

describe('resolvePrivyEmbeddedWalletId', () => {
  it('returns embedded wallet id for matching address', async () => {
    const { resolvePrivyEmbeddedWalletId } = await import('./privyUserApi');
    expect(
      resolvePrivyEmbeddedWalletId(
        [
          {
            id: 'wallet-id-123',
            type: 'wallet',
            address: '0xAbCdEf0123456789012345678901234567890AbCd',
            connector_type: 'embedded',
            wallet_client_type: 'privy',
            chain_type: 'ethereum'
          }
        ],
        '0xabcdef0123456789012345678901234567890abcd'
      )
    ).toBe('wallet-id-123');
  });
});
