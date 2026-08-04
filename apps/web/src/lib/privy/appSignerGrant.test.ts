import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('./privyHttp', () => ({
  privyApiBase: () => 'https://auth.privy.io/api',
  privyHeaders: () => ({})
}));

const quorumId = vi.fn(() => 'quorum-abc');
vi.mock('./privyAuthorizationSignature', () => ({
  privyAuthorizationKeyQuorumId: () => quorumId()
}));

const { walletHasAppSigner } = await import('./appSignerGrant');

const ADDRESS = '0x1234567890123456789012345678901234567890';

function respond(body: unknown, ok = true) {
  fetchMock.mockResolvedValueOnce({ ok, json: async () => body });
}

afterEach(() => {
  fetchMock.mockReset();
  quorumId.mockReturnValue('quorum-abc');
});

describe('walletHasAppSigner', () => {
  it('is true when the quorum is an additional signer', async () => {
    respond({ data: [{ address: ADDRESS, additional_signers: [{ signer_id: 'quorum-abc' }] }] });
    expect(await walletHasAppSigner(ADDRESS)).toBe(true);
  });

  it('is true when the quorum owns the wallet', async () => {
    respond({ data: [{ address: ADDRESS, owner_id: 'quorum-abc' }] });
    expect(await walletHasAppSigner(ADDRESS)).toBe(true);
  });

  it('is false when another signer is present but not ours', async () => {
    respond({ data: [{ address: ADDRESS, additional_signers: [{ signer_id: 'otro' }] }] });
    expect(await walletHasAppSigner(ADDRESS)).toBe(false);
  });

  it('matches the address case-insensitively', async () => {
    respond({
      data: [{ address: ADDRESS.toUpperCase(), additional_signers: [{ signer_id: 'quorum-abc' }] }]
    });
    expect(await walletHasAppSigner(ADDRESS)).toBe(true);
  });

  it('is undetermined when the wallet is not in the response', async () => {
    respond({ data: [] });
    expect(await walletHasAppSigner(ADDRESS)).toBeNull();
  });

  it('is undetermined when Privy rejects the lookup', async () => {
    respond({}, false);
    expect(await walletHasAppSigner(ADDRESS)).toBeNull();
  });

  it('is undetermined when no quorum is configured, so nothing is attempted blindly', async () => {
    quorumId.mockReturnValue('');
    expect(await walletHasAppSigner(ADDRESS)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
