import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ensureSanovaPrivyWallet unified identity', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('creates a Custom Auth + email user with authorization signers when none exists', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'test-app');
    vi.stubEnv('PRIVY_APP_SECRET', 'test-secret');
    vi.stubEnv('PRIVY_AUTHORIZATION_KEY_QUORUM_ID', 'quorum-abc');

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.includes('/v1/users/custom_auth/id')) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      if (href.includes('/v1/users/email/address')) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      if (href.endsWith('/v1/users') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          linked_accounts: Array<{ type: string; custom_user_id?: string; address?: string }>;
          wallets: Array<{ additional_signers?: Array<{ signer_id: string }> }>;
        };
        expect(body.linked_accounts).toEqual([
          { type: 'custom_auth', custom_user_id: 'user-sanova-1' },
          { type: 'email', address: 'investor@sanova.test' }
        ]);
        expect(body.wallets[0]?.additional_signers).toEqual([{ signer_id: 'quorum-abc' }]);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'did:privy:unified-1',
            linked_accounts: [
              { type: 'custom_auth', custom_user_id: 'user-sanova-1' },
              { type: 'email', address: 'investor@sanova.test' },
              {
                type: 'wallet',
                id: 'wallet-1',
                address: '0xUnifiedWallet',
                chain_type: 'ethereum',
                wallet_client_type: 'privy',
                connector_type: 'embedded'
              }
            ]
          })
        };
      }
      throw new Error(`Unexpected fetch ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { ensureSanovaPrivyWallet } = await import('./privyWalletProvisioning');
    const result = await ensureSanovaPrivyWallet({
      userId: 'user-sanova-1',
      email: 'investor@sanova.test'
    });

    expect(result).toEqual({
      address: '0xunifiedwallet',
      privyUserId: 'did:privy:unified-1',
      unifiedIdentity: true
    });
  });

  it('reuses an existing Custom Auth user wallet', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'test-app');
    vi.stubEnv('PRIVY_APP_SECRET', 'test-secret');
    vi.stubEnv('PRIVY_AUTHORIZATION_KEY_QUORUM_ID', 'quorum-abc');

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const href = String(url);
      if (href.includes('/v1/users/custom_auth/id')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'did:privy:custom-1',
            linked_accounts: [
              { type: 'custom_auth', custom_user_id: 'user-sanova-1' },
              {
                type: 'wallet',
                id: 'wallet-9',
                address: '0xCustomAuthWallet',
                chain_type: 'ethereum',
                wallet_client_type: 'privy',
                connector_type: 'embedded'
              }
            ]
          })
        };
      }
      if (href.includes('/v1/users/email/address')) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      throw new Error(`Unexpected fetch ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { ensureSanovaPrivyWallet } = await import('./privyWalletProvisioning');
    const result = await ensureSanovaPrivyWallet({
      userId: 'user-sanova-1',
      email: 'investor@sanova.test'
    });

    expect(result).toEqual({
      address: '0xcustomauthwallet',
      privyUserId: 'did:privy:custom-1',
      unifiedIdentity: true
    });
  });
});
