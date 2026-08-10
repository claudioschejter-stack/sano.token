import { beforeEach, describe, expect, it, vi } from 'vitest';

type Deposit = {
  id: string;
  provider: string | null;
  metadata: Record<string, unknown>;
};

let stale: Deposit[] = [];
const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
let lastWhere: Record<string, unknown> | null = null;

vi.mock('@sanova/database', () => ({
  prisma: {
    platformDeposit: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        lastWhere = args.where;
        return stale;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: args.where.id, data: args.data });
        return { id: args.where.id };
      }
    },
    paymentIntent: { findMany: async () => [], update: async () => ({}) }
  },
  Prisma: {}
}));

vi.mock('../admin/automationAlerts', () => ({ notifyAutomationIssue: async () => undefined }));
vi.mock('../blockchain/investorVaultShareDelivery', () => ({
  deliverVaultSharesForPaymentIntent: async () => ({ status: 'OK' })
}));
vi.mock('./paymentService', () => ({ expirePaymentIntent: async () => ({ status: 'EXPIRED' }) }));

const { expireStalePlatformDeposits } = await import('./paymentReconciliation');

beforeEach(() => {
  stale = [];
  updates.length = 0;
  lastWhere = null;
});

describe('expireStalePlatformDeposits', () => {
  it('cierra un depósito vencido al que nunca llegó plata', async () => {
    stale = [{ id: 'dep-1', provider: 'dlocal', metadata: {} }];

    const result = await expireStalePlatformDeposits();

    expect(result.expired).toBe(1);
    expect(updates[0].data.status).toBe('EXPIRED');
  });

  it('deja en paz el que está esperando USDC en treasury', async () => {
    // El fiat ya se cobró: vencerlo esconde plata en camino.
    stale = [{ id: 'dep-2', provider: 'macro_click', metadata: { awaitingTreasuryUsdc: true } }];

    const result = await expireStalePlatformDeposits();

    expect(result.expired).toBe(0);
    expect(result.skipped).toBe(1);
    expect(updates).toHaveLength(0);
  });

  it('solo busca los que no tienen txHash ni confirmedAt', async () => {
    await expireStalePlatformDeposits();

    expect(lastWhere).toMatchObject({
      status: 'PENDING',
      txHash: null,
      confirmedAt: null
    });
    expect(lastWhere).toHaveProperty('expiresAt');
  });

  it('deja registrado quién lo venció y cuándo', async () => {
    stale = [{ id: 'dep-3', provider: 'binance', metadata: { network: 'BASE' } }];

    await expireStalePlatformDeposits();

    const metadata = updates[0].data.metadata as Record<string, unknown>;
    expect(metadata.expiredBy).toBe('reconciliation');
    expect(typeof metadata.expiredAt).toBe('string');
    // Y no pierde lo que ya había.
    expect(metadata.network).toBe('BASE');
  });

  it('no hace nada cuando no hay vencidos', async () => {
    const result = await expireStalePlatformDeposits();
    expect(result).toMatchObject({ expired: 0, skipped: 0 });
  });
});
