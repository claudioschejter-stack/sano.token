import type { Prisma } from '@sanova/database';
import { ethers } from 'ethers';

export function decimalUsdToBaseUnits(amount: Prisma.Decimal, decimals = 6): bigint {
  return ethers.parseUnits(amount.toFixed(decimals), decimals);
}

export function sumDecimalUsdBaseUnits(
  rows: Array<{ amountUsd: Prisma.Decimal }>,
  decimals = 6
): bigint {
  return rows.reduce((sum, row) => sum + decimalUsdToBaseUnits(row.amountUsd, decimals), 0n);
}

export function readBatchTotalUsdcBaseUnits(
  intents: Array<{ amountUsd: Prisma.Decimal; metadata: Prisma.JsonValue }>,
  decimals = 6
): bigint {
  const metadata = (intents[0]?.metadata as Record<string, unknown>) ?? {};
  const stored = metadata.batchTotalUsdcBaseUnits;
  if (typeof stored === 'string' && stored.trim()) {
    try {
      return BigInt(stored);
    } catch {
      // fall through
    }
  }
  return sumDecimalUsdBaseUnits(intents, decimals);
}
