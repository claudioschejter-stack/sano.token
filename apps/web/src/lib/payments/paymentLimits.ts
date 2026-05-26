import { prisma } from '@sanova/database';

export async function assertPaymentCircuitOpen(projectId: string) {
  const threshold = Number(process.env.PAYMENT_CIRCUIT_BREAKER_FAILURES ?? 5);
  const windowMinutes = Number(process.env.PAYMENT_CIRCUIT_BREAKER_WINDOW_MINUTES ?? 30);
  const failures = await prisma.paymentIntent.count({
    where: {
      projectId,
      status: { in: ['FAILED', 'MANUAL_REVIEW'] },
      createdAt: { gte: new Date(Date.now() - windowMinutes * 60_000) }
    }
  });

  if (failures >= threshold) {
    throw new Error('PAYMENT_CIRCUIT_BREAKER_OPEN');
  }
}

export async function assertPaymentLimits(input: {
  userId: string;
  projectId: string;
  walletAddress?: string | null;
  amountUsd: number;
}) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const statuses = ['REQUIRES_PAYMENT', 'MANUAL_REVIEW', 'CONFIRMED'] as const;

  const [userRows, projectRows, walletRows] = await Promise.all([
    prisma.paymentIntent.findMany({
      where: { userId: input.userId, status: { in: [...statuses] }, createdAt: { gte: since } },
      select: { amountUsd: true }
    }),
    prisma.paymentIntent.findMany({
      where: { projectId: input.projectId, status: { in: [...statuses] }, createdAt: { gte: since } },
      select: { amountUsd: true }
    }),
    input.walletAddress
      ? prisma.paymentIntent.findMany({
          where: { payerWalletAddress: input.walletAddress, status: { in: [...statuses] }, createdAt: { gte: since } },
          select: { amountUsd: true }
        })
      : Promise.resolve([])
  ]);

  if (sum(userRows) + input.amountUsd > Number(process.env.PAYMENT_DAILY_USER_LIMIT_USD ?? 25000)) {
    throw new Error('PAYMENT_USER_DAILY_LIMIT');
  }
  if (sum(projectRows) + input.amountUsd > Number(process.env.PAYMENT_DAILY_PROJECT_LIMIT_USD ?? 250000)) {
    throw new Error('PAYMENT_PROJECT_DAILY_LIMIT');
  }
  if (sum(walletRows) + input.amountUsd > Number(process.env.PAYMENT_DAILY_WALLET_LIMIT_USD ?? 50000)) {
    throw new Error('PAYMENT_WALLET_DAILY_LIMIT');
  }
}

function sum(rows: Array<{ amountUsd: { toNumber: () => number } }>) {
  return rows.reduce((total, row) => total + row.amountUsd.toNumber(), 0);
}
