import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('./config', () => ({ privyAppId: () => 'app-1' }));
vi.mock('./privyHttp', () => ({
  privyApiBase: () => 'https://api.privy.io',
  privyHeaders: () => ({})
}));
vi.mock('./privyAuthorizationSignature', () => ({
  buildPrivyAuthorizationSignature: () => 'sig',
  isPrivyAuthorizationSigningConfigured: () => false
}));

const { privySendTransaction } = await import('./walletRpcApi');

function sentTransaction(): Record<string, unknown> {
  const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as {
    params: { transaction: Record<string, unknown> };
  };
  return body.params.transaction;
}

afterEach(() => fetchMock.mockReset());

describe('privySendTransaction', () => {
  it('omits `to` for a contract deployment, which has no recipient', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { hash: '0xdeploy' } })
    });

    await privySendTransaction({ walletId: 'w1', chainId: 8453, data: '0x60806040' });

    const tx = sentTransaction();
    expect(tx).not.toHaveProperty('to');
    expect(tx.data).toBe('0x60806040');
  });

  it('still sends `to` for a normal call', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { hash: '0xcall' } })
    });

    await privySendTransaction({
      walletId: 'w1',
      chainId: 8453,
      to: '0x1234567890123456789012345678901234567890',
      data: '0xabcdef'
    });

    expect(sentTransaction().to).toBe('0x1234567890123456789012345678901234567890');
  });
});
