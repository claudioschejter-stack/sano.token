import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export type ClaimBlockchainEventInput = {
  txHash?: string;
  eventName: string;
  contractAddress?: string;
  payload?: Prisma.InputJsonValue;
};

/**
 * Idempotent claim for on-chain events. Returns true when this worker should process side effects.
 * Duplicate txHash+event rows return false (P2002).
 */
export async function claimBlockchainEvent(
  tx: Prisma.TransactionClient,
  input: ClaimBlockchainEventInput
): Promise<boolean> {
  if (!input.txHash?.trim()) {
    return false;
  }

  try {
    await tx.blockchainEvent.create({
      data: {
        txHash: input.txHash,
        eventName: input.eventName,
        contractAddress: input.contractAddress ?? 'unknown',
        payload: input.payload
      }
    });
    return true;
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}
