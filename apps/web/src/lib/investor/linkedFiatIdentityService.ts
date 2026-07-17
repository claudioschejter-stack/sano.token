import { prisma } from '@sanova/database';

export type LinkedFiatIdentityDto = {
  id: string;
  provider: string;
  identifier: string;
  label: string | null;
  createdAt: string;
};

function serialize(row: {
  id: string;
  provider: string;
  identifier: string;
  label: string | null;
  createdAt: Date;
}): LinkedFiatIdentityDto {
  return {
    id: row.id,
    provider: row.provider,
    identifier: row.identifier,
    label: row.label,
    createdAt: row.createdAt.toISOString()
  };
}

/**
 * Auto-records the fiat "wallet" (Mercado Pago account, etc.) a user paid
 * with, so it can later be offered as a quick-select shortcut when they
 * request a fiat withdrawal. This never grants payout capability by itself —
 * see platformWithdrawalService for the (still admin-mediated) money movement.
 */
export async function linkFiatIdentity(input: {
  userId: string;
  provider: string;
  identifier: string;
  label?: string | null;
  capturedFrom?: string | null;
}): Promise<void> {
  const identifier = input.identifier.trim();
  if (!identifier) {
    return;
  }

  await prisma.linkedFiatIdentity.upsert({
    where: {
      userId_provider_identifier: {
        userId: input.userId,
        provider: input.provider,
        identifier
      }
    },
    update: { label: input.label ?? undefined },
    create: {
      userId: input.userId,
      provider: input.provider,
      identifier,
      label: input.label ?? null,
      capturedFrom: input.capturedFrom ?? null
    }
  });
}

export async function listLinkedFiatIdentities(userId: string): Promise<LinkedFiatIdentityDto[]> {
  const rows = await prisma.linkedFiatIdentity.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return rows.map(serialize);
}
