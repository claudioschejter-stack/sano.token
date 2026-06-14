import { prisma } from '@sanova/database';
import type { AdvisorContext } from './advisorContext';

export type AdvisorCommissionRow = {
  id: string;
  eventType: string;
  status: string;
  grossAmountUsd: number;
  feeAmountUsd: number;
  amountUsd: number;
  recipientRole: string;
  investorId: string | null;
  projectId: string | null;
  investmentId: string | null;
  advisorId: string | null;
  sourceAdvisorEmail: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type AdvisorCommissionSummary = {
  accruedTotalUsd: number;
  paidTotalUsd: number;
  purchaseAccruedUsd: number;
  rentAccruedUsd: number;
  rowCount: number;
};

function toUsd(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export async function getAdvisorCommissionSummary(
  ctx: AdvisorContext
): Promise<AdvisorCommissionSummary> {
  const rows = await prisma.commissionAccrual.findMany({
    where: {
      recipientUserId: ctx.userId,
      recipientRole: { in: ['ADVISOR', 'ADVISOR_MANAGER'] },
      status: { in: ['ACCRUED', 'PAID'] }
    },
    select: { amountUsd: true, status: true, eventType: true }
  });

  let accruedTotalUsd = 0;
  let paidTotalUsd = 0;
  let purchaseAccruedUsd = 0;
  let rentAccruedUsd = 0;

  for (const row of rows) {
    const amount = toUsd(row.amountUsd);
    if (row.status === 'PAID') {
      paidTotalUsd += amount;
    } else {
      accruedTotalUsd += amount;
      if (row.eventType === 'TOKEN_PURCHASE') {
        purchaseAccruedUsd += amount;
      } else if (row.eventType === 'RENT_DISTRIBUTION') {
        rentAccruedUsd += amount;
      }
    }
  }

  return {
    accruedTotalUsd,
    paidTotalUsd,
    purchaseAccruedUsd,
    rentAccruedUsd,
    rowCount: rows.length
  };
}

export async function listAdvisorCommissions(
  ctx: AdvisorContext,
  limit = 200
): Promise<AdvisorCommissionRow[]> {
  const rows = await prisma.commissionAccrual.findMany({
    where: {
      recipientUserId: ctx.userId,
      recipientRole: { in: ['ADVISOR', 'ADVISOR_MANAGER'] },
      status: { in: ['ACCRUED', 'PAID', 'CANCELLED'] }
    },
    include: {
      advisor: { include: { user: { select: { email: true } } } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    status: row.status,
    grossAmountUsd: toUsd(row.grossAmountUsd),
    feeAmountUsd: toUsd(row.feeAmountUsd),
    amountUsd: toUsd(row.amountUsd),
    recipientRole: row.recipientRole,
    investorId: row.investorId,
    projectId: row.projectId,
    investmentId: row.investmentId,
    advisorId: row.advisorId,
    sourceAdvisorEmail: row.advisor?.user.email ?? null,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null
  }));
}

export function buildCommissionDistributionCsv(rows: AdvisorCommissionRow[]): string {
  const header = [
    'id',
    'date',
    'event_type',
    'status',
    'recipient_role',
    'amount_usd',
    'gross_usd',
    'fee_usd',
    'source_advisor_email',
    'investor_id',
    'project_id',
    'investment_id',
    'paid_at'
  ].join(',');

  const lines = rows.map((row) =>
    [
      row.id,
      row.createdAt,
      row.eventType,
      row.status,
      row.recipientRole,
      row.amountUsd.toFixed(6),
      row.grossAmountUsd.toFixed(6),
      row.feeAmountUsd.toFixed(6),
      row.sourceAdvisorEmail ?? '',
      row.investorId ?? '',
      row.projectId ?? '',
      row.investmentId ?? '',
      row.paidAt ?? ''
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );

  return [header, ...lines].join('\n');
}
