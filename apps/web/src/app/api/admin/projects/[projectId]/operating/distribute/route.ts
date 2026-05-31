import { NextResponse } from 'next/server';
import { Prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../../../../lib/admin/requireAdmin';
import { allocateProjectRentByPreference } from '../../../../../../../lib/investor/rentPayoutService';
import {
  getOrCreateProjectOperatingAccount,
  creditProjectOperatingRent
} from '../../../../../../../lib/yield/projectOperatingService';
import { operatingAmountToUsd, normalizeOperatingCurrency } from '../../../../../../../lib/yield/yieldConversionRouter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/** Distribute net operating rent to investors by FIAT/USDC preference (no on-chain batch required). */
export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
    currency?: string;
    idempotencyKey?: string;
  };

  const currency = normalizeOperatingCurrency(body.currency ?? 'USD');
  const account = await getOrCreateProjectOperatingAccount(projectId, currency);
  const available = account.balance.toNumber();
  const amount = body.amount ?? available;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
  }
  if (amount > available) {
    return NextResponse.json({ error: 'INSUFFICIENT_OPERATING_BALANCE' }, { status: 400 });
  }

  const totalAmountUsd = operatingAmountToUsd(amount, currency);
  const idempotencyPrefix = body.idempotencyKey?.trim() || `rent-distribute:${projectId}:${currency}:${amount}`;

  try {
    const { prisma } = await import('@sanova/database');

    await prisma.$transaction(async (tx) => {
      const fresh = await tx.projectOperatingAccount.findUniqueOrThrow({ where: { id: account.id } });
      if (fresh.balance.toNumber() < amount) {
        throw new Error('INSUFFICIENT_OPERATING_BALANCE');
      }

      const nextBalance = fresh.balance.minus(amount);
      await tx.projectOperatingAccount.update({
        where: { id: account.id },
        data: { balance: nextBalance }
      });

      await tx.projectOperatingLedgerEntry.create({
        data: {
          accountId: account.id,
          projectId,
          type: 'CONVERSION_DEBIT',
          amount: new Prisma.Decimal(amount),
          currency,
          balanceAfter: nextBalance,
          idempotencyKey: `${idempotencyPrefix}:debit`,
          metadata: { reason: 'investor_rent_distribution' } as Prisma.InputJsonObject
        }
      });
    });

    const allocation = await allocateProjectRentByPreference({
      projectId,
      totalAmountUsd,
      sourceCurrency: currency,
      idempotencyPrefix
    });

    return NextResponse.json({
      ok: true,
      totalAmountUsd,
      sourceAmount: amount,
      sourceCurrency: currency,
      allocation
    });
  } catch (error) {
    console.error('[admin/operating/distribute]', error);
    const message = error instanceof Error ? error.message : 'Distribution failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
