import { prisma } from '@sanova/database';

export type InvestorActivityKind =
  | 'deposit'
  | 'withdrawal'
  | 'dividend'
  | 'purchase'
  | 'ledger_credit'
  | 'ledger_debit';

export type InvestorActivityItem = {
  id: string;
  kind: InvestorActivityKind;
  /** + inflow / − outflow in USD terms (USDC ≈ USD). */
  amountUsd: number;
  currency: string;
  status: string;
  title: string;
  subtitle: string | null;
  source: string | null;
  destination: string | null;
  txHash: string | null;
  occurredAt: string;
};

function toAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Unified investor ledger for dashboard “Últimas actividades” and wallet history.
 * Aggregates deposits, withdrawals, ledger rows, dividends and USDC cart purchases.
 */
export async function getInvestorActivityLedger(
  userId: string,
  options: { limit?: number } = {}
): Promise<InvestorActivityItem[]> {
  const limit = options.limit ?? 40;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { investorId: true }
  });

  const [deposits, withdrawals, ledger, dividends, purchases] = await Promise.all([
    prisma.platformDeposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        amountUsd: true,
        method: true,
        provider: true,
        payToAddress: true,
        payerWalletAddress: true,
        txHash: true,
        confirmedAt: true,
        createdAt: true,
        metadata: true
      }
    }),
    prisma.platformWithdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        amountUsd: true,
        method: true,
        destinationAddress: true,
        txHash: true,
        createdAt: true,
        confirmedAt: true
      }
    }),
    prisma.platformWalletLedgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        txHash: true,
        depositId: true,
        paymentIntentId: true
      }
    }),
    prisma.dividendDistribution.findMany({
      where: user?.investorId
        ? { OR: [{ userId: user.investorId }, { platformUserId: userId }] }
        : { platformUserId: userId },
      orderBy: { distributedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        distributedAt: true,
        txHash: true,
        assetId: true
      }
    }),
    prisma.paymentIntent.findMany({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'REQUIRES_PAYMENT', 'PENDING', 'MANUAL_REVIEW'] },
        method: { in: ['USDC_ONCHAIN', 'CUSTODIAL_STABLECOIN'] }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        amountUsd: true,
        method: true,
        txHash: true,
        createdAt: true,
        metadata: true
      }
    })
  ]);

  const items: InvestorActivityItem[] = [];

  for (const row of deposits) {
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    const custody = typeof meta.custody === 'string' ? meta.custody : null;
    items.push({
      id: `deposit:${row.id}`,
      kind: 'deposit',
      amountUsd: toAmount(row.amountUsd),
      currency: 'USDC',
      status: row.status,
      title:
        custody === 'privy_wallet' || row.provider === 'privy_inbound_watch'
          ? 'Depósito USDC en wallet Sanova'
          : `Depósito ${row.method}`,
      subtitle: row.provider ? `Vía ${row.provider}` : null,
      source: row.payerWalletAddress,
      destination: row.payToAddress,
      txHash: row.txHash,
      occurredAt: (row.confirmedAt ?? row.createdAt).toISOString()
    });
  }

  for (const row of withdrawals) {
    items.push({
      id: `withdrawal:${row.id}`,
      kind: 'withdrawal',
      amountUsd: -Math.abs(toAmount(row.amountUsd)),
      currency: 'USD',
      status: row.status,
      title: `Retiro ${row.method}`,
      subtitle: row.destinationAddress ? `Destino ${row.destinationAddress.slice(0, 10)}…` : null,
      source: 'platform_wallet',
      destination: row.destinationAddress,
      txHash: row.txHash,
      occurredAt: (row.confirmedAt ?? row.createdAt).toISOString()
    });
  }

  for (const row of ledger) {
    const amount = toAmount(row.amount);
    const type = String(row.type).toUpperCase();
    const isCredit = type.includes('CREDIT') || amount > 0;
    items.push({
      id: `ledger:${row.id}`,
      kind: isCredit ? 'ledger_credit' : 'ledger_debit',
      amountUsd: isCredit ? Math.abs(amount) : -Math.abs(amount),
      currency: row.currency || 'USD',
      status: row.status,
      title: `Movimiento ledger · ${row.type}`,
      subtitle: row.depositId
        ? `Depósito ${row.depositId.slice(0, 8)}`
        : row.paymentIntentId
          ? `Pago ${row.paymentIntentId.slice(0, 8)}`
          : null,
      source: null,
      destination: null,
      txHash: row.txHash,
      occurredAt: row.createdAt.toISOString()
    });
  }

  for (const row of dividends) {
    items.push({
      id: `dividend:${row.id}`,
      kind: 'dividend',
      amountUsd: toAmount(row.amount),
      currency: row.currency || 'USD',
      status: row.status,
      title: 'Dividendo / renta',
      subtitle: row.assetId ? `Activo ${row.assetId.slice(0, 8)}` : null,
      source: row.assetId,
      destination: 'platform_wallet',
      txHash: row.txHash,
      occurredAt: row.distributedAt.toISOString()
    });
  }

  for (const row of purchases) {
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    const batchId = typeof meta.cartBatchId === 'string' ? meta.cartBatchId : null;
    items.push({
      id: `purchase:${row.id}`,
      kind: 'purchase',
      amountUsd: -Math.abs(toAmount(row.amountUsd)),
      currency: 'USDC',
      status: row.status,
      title: 'Compra de tokens RWA',
      subtitle: batchId ? `Carrito ${batchId.slice(0, 8)}` : row.method,
      source: 'investor_wallet',
      destination: 'treasury',
      txHash: row.txHash,
      occurredAt: row.createdAt.toISOString()
    });
  }

  items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const seen = new Set<string>();
  const deduped: InvestorActivityItem[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.txHash ?? item.id}:${item.amountUsd.toFixed(2)}:${item.occurredAt.slice(0, 16)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }

  return deduped;
}
