import { prisma } from '@sanova/database';
import { completeYieldConversion, markYieldBatchFailed } from './yieldConversionService';

function parseUsdcAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function extractBatchIdFromRef(conversionRef?: string | null): string | null {
  if (!conversionRef) return null;
  if (conversionRef.startsWith('coinbase-yield-')) {
    return conversionRef.slice('coinbase-yield-'.length);
  }
  if (conversionRef.startsWith('yield-')) {
    return conversionRef.slice('yield-'.length);
  }
  if (conversionRef.startsWith('exchange-')) {
    const rest = conversionRef.slice('exchange-'.length);
    const lastDash = rest.lastIndexOf('-');
    if (lastDash > 0) return rest.slice(0, lastDash);
  }
  return null;
}

export async function resolveYieldBatch(input: {
  batchId?: string | null;
  conversionRef?: string | null;
}) {
  if (input.batchId) {
    return prisma.projectYieldBatch.findUnique({ where: { id: input.batchId } });
  }

  if (input.conversionRef) {
    const byRef = await prisma.projectYieldBatch.findFirst({
      where: { conversionRef: input.conversionRef }
    });
    if (byRef) return byRef;

    const inferredId = extractBatchIdFromRef(input.conversionRef);
    if (inferredId) {
      return prisma.projectYieldBatch.findUnique({ where: { id: inferredId } });
    }
  }

  return null;
}

export async function handleYieldConversionWebhook(input: {
  batchId?: string | null;
  conversionRef?: string | null;
  usdcAmount?: unknown;
  conversionTxHash?: string | null;
  provider: string;
  status?: 'completed' | 'failed';
  error?: string;
  payload?: Record<string, unknown>;
}) {
  const batch = await resolveYieldBatch({
    batchId: input.batchId,
    conversionRef: input.conversionRef
  });

  if (!batch) {
    return { ok: false as const, reason: 'BATCH_NOT_FOUND' };
  }

  if (input.status === 'failed') {
    const failed = await markYieldBatchFailed({
      batchId: batch.id,
      error: input.error ?? 'Conversion failed',
      provider: input.provider
    });
    return { ok: true as const, batch: failed, action: 'failed' as const };
  }

  const usdcAmount = parseUsdcAmount(input.usdcAmount);
  if (!usdcAmount) {
    return { ok: false as const, reason: 'INVALID_USDC_AMOUNT' };
  }

  const completed = await completeYieldConversion({
    batchId: batch.id,
    usdcAmount,
    conversionRef: input.conversionRef ?? batch.conversionRef,
    conversionTxHash: input.conversionTxHash,
    provider: input.provider,
    payload: input.payload
  });

  return { ok: true as const, batch: completed, action: 'completed' as const };
}
