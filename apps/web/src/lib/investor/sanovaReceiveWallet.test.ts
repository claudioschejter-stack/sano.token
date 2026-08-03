import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReadBalances = vi.fn();

vi.mock('../portfolio/onChainUsdcReader', () => ({
  readWalletUsdcBalances: (...args: unknown[]) => mockReadBalances(...args)
}));

vi.mock('@sanova/database', () => ({
  prisma: {
    user: { findUnique: vi.fn() }
  }
}));

vi.mock('./walletService', () => ({
  linkUserWallet: vi.fn()
}));

vi.mock('./linkedWalletPolicy', () => ({
  getLinkedWalletForUser: vi.fn()
}));

vi.mock('../privy/privyWalletProvisioning', () => ({
  listPrivyEthereumWalletAddressesForInvestor: vi.fn(),
  ensureSanovaPrivyWallet: vi.fn()
}));

vi.mock('../blockchain/autoAllowlistInvestorWallet', () => ({
  autoAllowlistInvestorWallet: vi.fn()
}));

import { pickCanonicalReceiveAddress } from './sanovaReceiveWallet';

describe('pickCanonicalReceiveAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the only candidate', async () => {
    mockReadBalances.mockResolvedValue([{ amountUsdc: 0 }]);
    const chosen = await pickCanonicalReceiveAddress({
      candidates: ['0xb3116d28d070b5bab56221b2882dce663699cc76'],
      linkedAddress: null
    });
    expect(chosen).toBe('0xb3116d28d070b5bab56221b2882dce663699cc76');
  });

  it('prefers the Privy wallet that already holds USDC on Base', async () => {
    mockReadBalances.mockImplementation(async (address: string) => {
      if (address.toLowerCase() === '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41') {
        return [{ amountUsdc: 20 }];
      }
      return [{ amountUsdc: 0 }];
    });

    const chosen = await pickCanonicalReceiveAddress({
      candidates: [
        '0xb3116d28d070b5bab56221b2882dce663699cc76',
        '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41'
      ],
      linkedAddress: '0xb3116d28d070b5bab56221b2882dce663699cc76'
    });

    expect(chosen).toBe('0x840aed84455c3a30ef23a34a4d961bc3e1d06b41');
  });

  it('keeps the linked wallet when no candidate has USDC', async () => {
    mockReadBalances.mockResolvedValue([{ amountUsdc: 0 }]);
    const linked = '0xb3116d28d070b5bab56221b2882dce663699cc76';
    const chosen = await pickCanonicalReceiveAddress({
      candidates: [linked, '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41'],
      linkedAddress: linked
    });
    expect(chosen).toBe(linked);
  });
});
