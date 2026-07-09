import { Prisma, prisma } from '@sanova/database';

/** Thrown when a user's KYC document (cuit) is already tied to a different account's Investor record. */
export class DocumentAlreadyRegisteredError extends Error {
  constructor(public readonly conflictingInvestorId: string) {
    super('DOCUMENT_ALREADY_REGISTERED');
    this.name = 'DocumentAlreadyRegisteredError';
  }
}

export function isCuitUniqueConflict(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes('cuit');
  }
  return typeof target === 'string' && target.includes('cuit');
}

/**
 * Two people can never share a KYC document (cuit), so `Investor.cuit` is unique.
 * If a create() hits that constraint, either:
 * - an orphaned Investor row already exists for this document with no owning user
 *   (adopt it instead of failing), or
 * - another account already legitimately owns this identity (a real conflict —
 *   throw DocumentAlreadyRegisteredError so callers can surface a clear message
 *   instead of a raw 500/502).
 */
export async function resolveOrphanedInvestorByCuit(
  cuit: string,
  currentUserId: string
): Promise<string> {
  const conflicting = await prisma.investor.findUnique({ where: { cuit } });
  if (!conflicting) {
    // Constraint fired but the row is gone by the time we re-read it (race) —
    // let the caller retry the original create.
    throw new Error('CUIT_CONFLICT_RESOLVED_CONCURRENTLY');
  }

  const owner = await prisma.user.findFirst({
    where: { investorId: conflicting.id, NOT: { id: currentUserId } },
    select: { id: true }
  });

  if (owner) {
    throw new DocumentAlreadyRegisteredError(conflicting.id);
  }

  return conflicting.id;
}
