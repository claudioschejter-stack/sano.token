import { prisma, Prisma, type YieldConversionRail } from '@sanova/database';

async function markBatchConverting(batchId: string, patch: Prisma.ProjectYieldBatchUpdateInput) {
  return prisma.projectYieldBatch.update({
    where: { id: batchId },
    data: { status: 'CONVERTING', ...patch }
  });
}

async function startBridgeConversion(batch: {
  id: string;
  sourceAmount: Prisma.Decimal;
}) {
  const apiKey = process.env.BRIDGE_API_KEY?.trim();
  if (!apiKey) throw new Error('BRIDGE_API_KEY_NOT_CONFIGURED');

  const conversionRef = `yield-${batch.id}`;
  const updated = await markBatchConverting(batch.id, {
    conversionRef,
    metadata: {
      provider: 'bridge',
      note: 'Awaiting Bridge on-ramp completion webhook'
    } as Prisma.InputJsonObject
  });

  return {
    batch: updated,
    mode: 'async' as const,
    rail: 'BRIDGE' as YieldConversionRail,
    conversionRef,
    message: 'Batch awaiting Bridge webhook confirmation'
  };
}

async function startCoinbaseConversion(batch: { id: string; sourceAmount: Prisma.Decimal }) {
  const apiKey = process.env.COINBASE_ADVANCED_TRADE_API_KEY?.trim();
  if (!apiKey) throw new Error('COINBASE_ADVANCED_TRADE_API_KEY_NOT_CONFIGURED');

  const conversionRef = `coinbase-yield-${batch.id}`;
  const updated = await markBatchConverting(batch.id, {
    conversionRef,
    metadata: {
      provider: 'coinbase',
      requestedUsd: batch.sourceAmount.toNumber(),
      note: 'Awaiting Coinbase conversion webhook with USDC amount'
    } as Prisma.InputJsonObject
  });

  return {
    batch: updated,
    mode: 'async' as const,
    rail: 'COINBASE' as YieldConversionRail,
    conversionRef,
    message: 'Batch awaiting Coinbase / yield-conversion webhook'
  };
}

async function startExchangeConversion(batch: {
  id: string;
  sourceCurrency: string;
  sourceAmount: Prisma.Decimal;
}) {
  const conversionRef = `exchange-${batch.id}-${batch.sourceCurrency.toLowerCase()}`;
  const updated = await markBatchConverting(batch.id, {
    conversionRef,
    metadata: {
      provider: 'exchange',
      sourceCurrency: batch.sourceCurrency,
      note: 'Convert ARS off-platform; confirm via /api/webhooks/yield-conversion'
    } as Prisma.InputJsonObject
  });

  return {
    batch: updated,
    mode: 'async' as const,
    rail: 'EXCHANGE' as YieldConversionRail,
    conversionRef,
    message: 'Batch awaiting exchange webhook with USDC on Base'
  };
}

export async function completeYieldConversion(input: {
  batchId: string;
  usdcAmount: number;
  conversionRef?: string | null;
  conversionTxHash?: string | null;
  provider: string;
  payload?: Record<string, unknown>;
}) {
  if (!Number.isFinite(input.usdcAmount) || input.usdcAmount <= 0) {
    throw new Error('INVALID_USDC_AMOUNT');
  }

  const batch = await prisma.projectYieldBatch.findUnique({ where: { id: input.batchId } });
  if (!batch) throw new Error('BATCH_NOT_FOUND');
  if (batch.status === 'COMPLETED') return batch;
  if (input.conversionRef && batch.conversionRef && batch.conversionRef !== input.conversionRef) {
    throw new Error('CONVERSION_REF_MISMATCH');
  }

  const updated = await prisma.projectYieldBatch.update({
    where: { id: batch.id },
    data: {
      status: 'USDC_READY',
      usdcAmount: input.usdcAmount,
      conversionTxHash: input.conversionTxHash ?? undefined,
      error: null,
      metadata: {
        ...(batch.metadata as object),
        conversionCompletedBy: input.provider,
        conversionPayload: input.payload ?? null
      } as Prisma.InputJsonObject
    }
  });

  const { enqueueYieldDistributionJob } = await import('./yieldJobProcessor');
  await enqueueYieldDistributionJob(updated.id);
  return updated;
}

export async function markYieldBatchFailed(input: {
  batchId?: string;
  conversionRef?: string;
  error: string;
  provider?: string;
}) {
  const batch =
    input.batchId != null
      ? await prisma.projectYieldBatch.findUnique({ where: { id: input.batchId } })
      : input.conversionRef
        ? await prisma.projectYieldBatch.findFirst({ where: { conversionRef: input.conversionRef } })
        : null;

  if (!batch) throw new Error('BATCH_NOT_FOUND');
  if (batch.status === 'COMPLETED') return batch;

  return prisma.projectYieldBatch.update({
    where: { id: batch.id },
    data: {
      status: 'FAILED',
      error: input.error,
      metadata: {
        ...(batch.metadata as object),
        failedBy: input.provider ?? 'webhook'
      } as Prisma.InputJsonObject
    }
  });
}

export async function processYieldBatchConversion(batchId: string) {
  const batch = await prisma.projectYieldBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error('BATCH_NOT_FOUND');
  if (['USDC_READY', 'DISTRIBUTING', 'COMPLETED'].includes(batch.status)) {
    return { batch, skipped: true as const };
  }

  const rail = batch.conversionRail;
  if (!rail) throw new Error('CONVERSION_RAIL_MISSING');

  if (rail === 'MANUAL_USDC') {
    const usdc = batch.usdcAmount?.toNumber() ?? batch.sourceAmount.toNumber();
    const updated = await completeYieldConversion({
      batchId: batch.id,
      usdcAmount: usdc,
      provider: 'manual_usdc'
    });
    return { batch: updated, skipped: false as const };
  }

  if (rail === 'BRIDGE') return startBridgeConversion(batch);
  if (rail === 'COINBASE') return startCoinbaseConversion(batch);
  if (rail === 'EXCHANGE') return startExchangeConversion(batch);

  throw new Error(`UNSUPPORTED_RAIL:${rail}`);
}
