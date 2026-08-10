import { beforeEach, describe, expect, it, vi } from 'vitest';

const kycApproved = vi.fn();

vi.mock('ethers', () => ({
  JsonRpcProvider: class {
    destroy() {}
  },
  Contract: class {
    kycApproved = (wallet: string) => kycApproved(wallet);
  }
}));

vi.mock('@sanova/database', () => ({
  prisma: {
    investorAllowlist: {
      findFirst: vi.fn(async () => ({ id: 'allow-1', approved: true }))
    }
  }
}));

const { assertTokenizedPurchaseReady } = await import('./purchaseGuard');

const project = {
  vaultAddress: '0x56dB993fcf2245e6124692D99b0186CF53392d89',
  contractAddress: '0x481fAa4102Fb080e8291cA49d1e70bA42d36c8F1',
  chainId: 8453
};
const wallet = '0x840aed84455c3a30ef23a34a4d961bc3e1d06b41';

describe('assertTokenizedPurchaseReady y las lecturas throttleadas', () => {
  beforeEach(() => {
    kycApproved.mockReset();
  });

  it('deja pasar la compra cuando la wallet está aprobada on-chain', async () => {
    kycApproved.mockResolvedValue(true);
    await expect(
      assertTokenizedPurchaseReady({ project, projectId: 'proj-1', walletAddress: wallet })
    ).resolves.toBeUndefined();
  });

  it('rechaza cuando la cadena dice que no está aprobada', async () => {
    kycApproved.mockResolvedValue(false);
    await expect(
      assertTokenizedPurchaseReady({ project, projectId: 'proj-1', walletAddress: wallet })
    ).rejects.toThrow('ONCHAIN_ALLOWLIST_NOT_APPROVED');
  });

  /**
   * El RPC público devuelve "missing revert data" cuando throttlea. Antes eso
   * viajaba crudo hasta el inversor y mataba la compra de una wallet que estaba
   * perfectamente aprobada.
   */
  it('reintenta una lectura throttleada y sigue si la segunda funciona', async () => {
    kycApproved
      .mockRejectedValueOnce(new Error('missing revert data'))
      .mockResolvedValueOnce(true);
    await expect(
      assertTokenizedPurchaseReady({ project, projectId: 'proj-1', walletAddress: wallet })
    ).resolves.toBeUndefined();
    expect(kycApproved).toHaveBeenCalledTimes(2);
  });

  it('distingue "no pude leer" de "no aprobada" cuando fallan todos los intentos', async () => {
    kycApproved.mockRejectedValue(new Error('missing revert data'));
    await expect(
      assertTokenizedPurchaseReady({ project, projectId: 'proj-1', walletAddress: wallet })
    ).rejects.toThrow('ONCHAIN_ALLOWLIST_UNREADABLE');
  });

  it('no consulta la cadena si falta la fila de allowlist', async () => {
    const { prisma } = await import('@sanova/database');
    vi.mocked(prisma.investorAllowlist.findFirst).mockResolvedValueOnce(null);
    await expect(
      assertTokenizedPurchaseReady({ project, projectId: 'proj-1', walletAddress: wallet })
    ).rejects.toThrow('ALLOWLIST_NOT_APPROVED');
    expect(kycApproved).not.toHaveBeenCalled();
  });
});
