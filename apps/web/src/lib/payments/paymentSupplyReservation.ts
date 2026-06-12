import type { Prisma } from '@sanova/database';

type Tx = Prisma.TransactionClient;

type IntentSupplyRow = {
  id: string;
  projectId: string;
  tokenCount: number;
  metadata: Prisma.JsonValue;
};

export async function reserveProjectTokens(
  tx: Tx,
  projectId: string,
  tokenCount: number
): Promise<boolean> {
  const result = await tx.project.updateMany({
    where: {
      id: projectId,
      availableTokens: { gte: tokenCount }
    },
    data: {
      availableTokens: { decrement: tokenCount }
    }
  });

  return result.count > 0;
}

export async function releaseProjectTokens(tx: Tx, projectId: string, tokenCount: number) {
  await tx.project.update({
    where: { id: projectId },
    data: {
      availableTokens: { increment: tokenCount }
    }
  });
}

export function intentHasSupplyReserved(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.supplyReserved === true;
}

export async function releaseSupplyForIntent(tx: Tx, intent: IntentSupplyRow) {
  const metadata = (intent.metadata as Record<string, unknown>) ?? {};
  if (!intentHasSupplyReserved(metadata)) {
    return;
  }

  await releaseProjectTokens(tx, intent.projectId, intent.tokenCount);
  await tx.paymentIntent.update({
    where: { id: intent.id },
    data: {
      metadata: {
        ...metadata,
        supplyReserved: false
      } as Prisma.InputJsonObject
    }
  });
}

export function supplyReservedMetadata(tokenCount: number): Prisma.InputJsonObject {
  return {
    reservedTokens: tokenCount,
    supplyReserved: true
  };
}
