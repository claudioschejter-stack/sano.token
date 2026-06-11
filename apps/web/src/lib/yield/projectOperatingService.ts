import { prisma, Prisma, type ProjectOperatingEntryType } from '@sanova/database';
import { getAdminAsset } from '../admin/assetsService';
import {
  chooseYieldConversionRail,
  normalizeOperatingCurrency,
  operatingAmountToUsd,
  yieldConversionMinUsd
} from './yieldConversionRouter';
import { enqueueYieldBatchJobs } from './yieldJobProcessor';

export async function getOrCreateProjectOperatingAccount(projectId: string, currency: string) {
  const normalized = normalizeOperatingCurrency(currency);
  return prisma.projectOperatingAccount.upsert({
    where: { projectId_currency: { projectId, currency: normalized } },
    create: { projectId, currency: normalized },
    update: {}
  });
}

export async function getProjectOperatingSummary(projectId: string) {
  const accounts = await prisma.projectOperatingAccount.findMany({
    where: { projectId },
    orderBy: { currency: 'asc' }
  });
  const ledger = await prisma.projectOperatingLedgerEntry.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 25
  });
  const batches = await prisma.projectYieldBatch.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  const asset = await getAdminAsset(projectId);

  return {
    projectId,
    vaultAddress: asset?.vaultAddress ?? null,
    chainId: asset?.chainId ?? null,
    accounts: accounts.map((account) => ({
      currency: account.currency,
      balance: account.balance.toString(),
      balanceUsdEstimate: operatingAmountToUsd(account.balance.toNumber(), account.currency)
    })),
    ledger: ledger.map((entry) => ({
      id: entry.id,
      type: entry.type,
      amount: entry.amount.toString(),
      currency: entry.currency,
      balanceAfter: entry.balanceAfter.toString(),
      batchId: entry.batchId,
      createdAt: entry.createdAt.toISOString(),
      metadata: entry.metadata
    })),
    batches: batches.map((batch) => ({
      id: batch.id,
      status: batch.status,
      sourceCurrency: batch.sourceCurrency,
      sourceAmount: batch.sourceAmount.toString(),
      usdcAmount: batch.usdcAmount?.toString() ?? null,
      conversionRail: batch.conversionRail,
      conversionRef: batch.conversionRef,
      distributionTxHash: batch.distributionTxHash,
      error: batch.error,
      createdAt: batch.createdAt.toISOString(),
      completedAt: batch.completedAt?.toISOString() ?? null
    }))
  };
}

/** Credit tenant rent to project operating balance (NOT investor PlatformWallet). */
export async function creditProjectOperatingRent(input: {
  projectId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
  actorUserId?: string | null;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new Error('PROJECT_NOT_FOUND');

  const currency = normalizeOperatingCurrency(input.currency);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.projectOperatingLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) return { entry: existing, created: false };

    const account = await tx.projectOperatingAccount.upsert({
      where: { projectId_currency: { projectId: input.projectId, currency } },
      create: { projectId: input.projectId, currency },
      update: {}
    });

    const amount = new Prisma.Decimal(input.amount);
    const nextBalance = account.balance.plus(amount);

    await tx.projectOperatingAccount.update({
      where: { id: account.id },
      data: { balance: nextBalance }
    });

    const entry = await tx.projectOperatingLedgerEntry.create({
      data: {
        accountId: account.id,
        projectId: input.projectId,
        type: 'RENT_CREDIT' satisfies ProjectOperatingEntryType,
        amount,
        currency,
        balanceAfter: nextBalance,
        idempotencyKey: input.idempotencyKey,
        metadata: {
          ...(input.metadata as object),
          actorUserId: input.actorUserId ?? null,
          source: 'tenant_rent'
        } as Prisma.InputJsonObject
      }
    });

    return { entry, created: true };
  });
}

/** Debit operating balance after a successful investor rent payout (idempotent). */
export async function debitProjectOperatingForDistribution(input: {
  accountId: string;
  projectId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const currency = normalizeOperatingCurrency(input.currency);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.projectOperatingLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) {
      return { entry: existing, created: false };
    }

    const fresh = await tx.projectOperatingAccount.findUniqueOrThrow({ where: { id: input.accountId } });
    if (fresh.balance.toNumber() < input.amount) {
      throw new Error('INSUFFICIENT_OPERATING_BALANCE');
    }

    const amount = new Prisma.Decimal(input.amount);
    const nextBalance = fresh.balance.minus(amount);

    await tx.projectOperatingAccount.update({
      where: { id: input.accountId },
      data: { balance: nextBalance }
    });

    const entry = await tx.projectOperatingLedgerEntry.create({
      data: {
        accountId: input.accountId,
        projectId: input.projectId,
        type: 'CONVERSION_DEBIT',
        amount,
        currency,
        balanceAfter: nextBalance,
        idempotencyKey: input.idempotencyKey,
        metadata: {
          reason: 'investor_rent_distribution',
          ...(input.metadata as object)
        } as Prisma.InputJsonObject
      }
    });

    return { entry, created: true };
  });
}

export async function createYieldBatchFromOperatingBalance(input: {
  projectId: string;
  currency: string;
  amount?: number;
}) {
  const currency = normalizeOperatingCurrency(input.currency);
  const account = await getOrCreateProjectOperatingAccount(input.projectId, currency);
  const available = account.balance.toNumber();
  const amount = input.amount ?? available;

  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_BATCH_AMOUNT');
  if (amount > available) throw new Error('INSUFFICIENT_OPERATING_BALANCE');

  const minUsd = yieldConversionMinUsd(currency);
  const amountUsd = operatingAmountToUsd(amount, currency);
  if (amountUsd < minUsd) {
    throw new Error(`BELOW_CONVERSION_MINIMUM:${minUsd}`);
  }

  const quote = chooseYieldConversionRail(currency);
  const asset = await getAdminAsset(input.projectId);
  if (!asset?.vaultAddress) throw new Error('VAULT_NOT_CONFIGURED');

  const batch = await prisma.$transaction(async (tx) => {
    const fresh = await tx.projectOperatingAccount.findUniqueOrThrow({ where: { id: account.id } });
    if (fresh.balance.toNumber() < amount) throw new Error('INSUFFICIENT_OPERATING_BALANCE');

    const nextBalance = fresh.balance.minus(amount);
    await tx.projectOperatingAccount.update({
      where: { id: account.id },
      data: { balance: nextBalance }
    });

    const created = await tx.projectYieldBatch.create({
      data: {
        projectId: input.projectId,
        status: 'QUEUED',
        sourceCurrency: currency,
        sourceAmount: amount,
        conversionRail: quote.rail,
        vaultAddress: asset.vaultAddress,
        chainId: asset.chainId ?? 8453,
        metadata: {
          quote,
          amountUsdEstimate: amountUsd
        } as Prisma.InputJsonObject
      }
    });

    await tx.projectOperatingLedgerEntry.create({
      data: {
        accountId: account.id,
        projectId: input.projectId,
        type: 'CONVERSION_DEBIT',
        amount: new Prisma.Decimal(amount),
        currency,
        balanceAfter: nextBalance,
        idempotencyKey: `batch-debit:${created.id}`,
        batchId: created.id,
        metadata: { rail: quote.rail } as Prisma.InputJsonObject
      }
    });

    return created;
  });

  await enqueueYieldBatchJobs(batch.id);
  return batch;
}

export async function listProjectsReadyForYieldConversion(limit = 20) {
  const accounts = await prisma.projectOperatingAccount.findMany({
    where: { balance: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
    take: limit
  });

  return accounts.filter((account) => {
    const usd = operatingAmountToUsd(account.balance.toNumber(), account.currency);
    return usd >= yieldConversionMinUsd(account.currency);
  });
}
