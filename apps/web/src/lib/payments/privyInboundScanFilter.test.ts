import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El escaneo de wallets Privy venía tirando excepción en cada corrida del cron
 * porque filtraba `Investor.walletAddress` con `not: null`, y esa columna no es
 * nullable. Prisma rechazaba la consulta entera con "Argument `not` must not be
 * null", así que la red de seguridad de los depósitos no escaneaba nada.
 *
 * Este test mira el filtro que se le pasa a Prisma, que es donde estaba el error:
 * un mock permisivo lo habría dejado pasar igual.
 */

const userFindMany = vi.fn();
const intentFindMany = vi.fn();

vi.mock('@sanova/database', () => ({
  prisma: {
    paymentIntent: {
      findMany: (...args: unknown[]) => intentFindMany(...args),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn()
    },
    platformDeposit: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn()
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ investorId: null }),
      findMany: (...args: unknown[]) => userFindMany(...args)
    }
  },
  Prisma: { Decimal: class {} }
}));

vi.mock('../investor/linkedWalletPolicy', () => ({
  getLinkedWalletForUser: vi.fn().mockResolvedValue(null)
}));
vi.mock('../investor/sanovaReceiveWallet', () => ({
  ensureSanovaReceiveWalletForUser: vi.fn().mockResolvedValue(null)
}));
vi.mock('../portfolio/onChainUsdcReader', () => ({
  readWalletUsdcBalanceDetailed: vi.fn().mockResolvedValue({ ok: true, amountUsdc: 0, balances: [] })
}));
vi.mock('./stablecoinNetworks', () => ({
  getStablecoinNetwork: () => ({ id: 'BASE', kind: 'EVM', decimals: 6, rpcUrl: null, tokenAddress: null })
}));
vi.mock('./paymentConfig', () => ({
  paymentMinimumConfirmations: () => 1,
  paymentOrderTtlMinutes: () => 30
}));
vi.mock('./platformWalletService', () => ({ serializeDeposit: (row: unknown) => row }));

beforeEach(() => {
  intentFindMany.mockResolvedValue([]);
  userFindMany.mockResolvedValue([]);
});

describe('scanAllPrivyInboundWallets: el filtro de usuarios', () => {
  it('no filtra la wallet del investor con `not: null`, que Prisma rechaza', async () => {
    const { scanAllPrivyInboundWallets } = await import('./privyInboundUsdcService');
    await scanAllPrivyInboundWallets();

    const where = userFindMany.mock.calls[0][0].where as {
      OR: Array<Record<string, unknown>>;
    };
    const investorClause = where.OR.find((clause) => 'investor' in clause) as
      | { investor: { walletAddress: unknown } }
      | undefined;

    expect(investorClause).toBeDefined();
    expect(investorClause!.investor.walletAddress).not.toEqual({ not: null });
  });

  it('excluye los placeholders `pending:` en vez de tratarlos como wallet', async () => {
    const { scanAllPrivyInboundWallets } = await import('./privyInboundUsdcService');
    await scanAllPrivyInboundWallets();

    const where = userFindMany.mock.calls[0][0].where as {
      OR: Array<Record<string, unknown>>;
    };
    const investorClause = where.OR.find((clause) => 'investor' in clause) as {
      investor: { walletAddress: { not: { startsWith: string } } };
    };

    expect(investorClause.investor.walletAddress.not.startsWith).toBe('pending:');
  });

  it('sigue incluyendo a los que tienen wallet propia, que sí es nullable', async () => {
    const { scanAllPrivyInboundWallets } = await import('./privyInboundUsdcService');
    await scanAllPrivyInboundWallets();

    const where = userFindMany.mock.calls[0][0].where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(where.OR).toContainEqual({ walletAddress: { not: null } });
  });

  it('devuelve un resultado en vez de tirar cuando no hay a quién escanear', async () => {
    const { scanAllPrivyInboundWallets } = await import('./privyInboundUsdcService');

    await expect(scanAllPrivyInboundWallets()).resolves.toMatchObject({
      scanned: 0,
      newInbounds: 0,
      readyToAutoSettle: 0
    });
  });
});
