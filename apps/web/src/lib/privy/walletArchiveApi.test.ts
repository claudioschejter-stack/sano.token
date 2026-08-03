import { describe, expect, it } from 'vitest';
import { listEthereumWalletsWithIds, walletIdForAddress } from './walletArchiveApi';

const emailUser = {
  id: 'did:privy:email',
  linked_accounts: [
    { type: 'email', address: 'investor@sanova.test' },
    {
      type: 'wallet',
      id: 'wallet-original',
      address: '0x840aed84455C3a30Ef23a34a4D961BC3e1D06B41',
      chain_type: 'ethereum'
    }
  ]
};

const customUser = {
  id: 'did:privy:custom',
  linked_accounts: [
    {
      type: 'wallet',
      id: 'wallet-fork',
      address: '0xFFD5a9d5005eC4bd74B9A3e09384c3afCdC37a55',
      chain_type: 'ethereum'
    },
    { type: 'wallet', id: 'sol-wallet', address: 'SoLxyz', chain_type: 'solana' }
  ]
};

describe('listEthereumWalletsWithIds', () => {
  it('returns only ethereum wallets with ids, lowercased', () => {
    expect(listEthereumWalletsWithIds(customUser.linked_accounts)).toEqual([
      { id: 'wallet-fork', address: '0xffd5a9d5005ec4bd74b9a3e09384c3afcdc37a55' }
    ]);
  });
});

describe('walletIdForAddress', () => {
  it('finds the wallet id across email and custom auth identities', () => {
    const users = [emailUser, customUser] as Parameters<typeof walletIdForAddress>[0];
    expect(walletIdForAddress(users, '0x840AED84455C3A30EF23A34A4D961BC3E1D06B41')).toBe(
      'wallet-original'
    );
    expect(walletIdForAddress(users, '0xffd5a9d5005ec4bd74b9a3e09384c3afcdc37a55')).toBe(
      'wallet-fork'
    );
  });

  it('returns null for unknown addresses', () => {
    const users = [emailUser] as Parameters<typeof walletIdForAddress>[0];
    expect(walletIdForAddress(users, '0x0000000000000000000000000000000000000001')).toBeNull();
  });
});
