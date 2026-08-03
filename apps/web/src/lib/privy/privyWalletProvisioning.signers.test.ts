import { afterEach, describe, expect, it, vi } from 'vitest';

describe('privyWalletProvisioning additional_signers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('includes authorization key quorum when creating a wallet', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'test-app');
    vi.stubEnv('PRIVY_APP_SECRET', 'test-secret');
    vi.stubEnv('PRIVY_AUTHORIZATION_KEY_QUORUM_ID', 'quorum-abc');

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/v1/users/email/address')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'did:privy:user-1',
            linked_accounts: []
          })
        };
      }
      if (String(url).endsWith('/v1/wallets') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          additional_signers?: Array<{ signer_id: string }>;
        };
        expect(body.additional_signers).toEqual([{ signer_id: 'quorum-abc' }]);
        return {
          ok: true,
          status: 200,
          json: async () => ({ address: '0xabc' })
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { pregenerateOrFetchPrivyWallet } = await import('./privyWalletProvisioning');
    const address = await pregenerateOrFetchPrivyWallet('investor@sanova.test');
    expect(address).toBe('0xabc');
    expect(fetchMock).toHaveBeenCalled();
  });
});
