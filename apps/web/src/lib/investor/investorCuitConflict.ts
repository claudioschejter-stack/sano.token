import { Prisma, prisma } from '@sanova/database';

// Duplicated from `provisionInvestorProfile.ts` (not imported) to avoid a
// circular dependency — that module already imports from this one.
function isPendingWalletPlaceholder(walletAddress: string | null | undefined): boolean {
  return Boolean(walletAddress?.toLowerCase().startsWith('pending:'));
}

/** Thrown when a user's KYC document (cuit) is already tied to a different account's Investor record. */
export class DocumentAlreadyRegisteredError extends Error {
  constructor(public readonly conflictingInvestorId: string) {
    super('DOCUMENT_ALREADY_REGISTERED');
    this.name = 'DocumentAlreadyRegisteredError';
  }
}

/**
 * Detects a genuinely established duplicate account for a KYC document: a
 * different user already owns an Investor row with this same `cuit` AND
 * that account already has a real (non-pending) embedded wallet.
 *
 * Deliberately narrower than the generic CUIT-uniqueness check used during
 * investor provisioning: an existing account that only has KYC approved but
 * never got a wallet isn't "established" yet, so it must NOT block this new
 * attempt — only a fully set-up account (document + real wallet) should.
 */
export async function findDuplicateAccountWithRealWallet(
  cuit: string,
  currentUserId: string
): Promise<{ investorId: string; ownerUserId: string } | null> {
  const trimmed = cuit.trim();
  if (!trimmed) {
    return null;
  }

  const conflicting = await prisma.investor.findUnique({
    where: { cuit: trimmed },
    select: { id: true, walletAddress: true }
  });

  if (!conflicting?.walletAddress || isPendingWalletPlaceholder(conflicting.walletAddress)) {
    return null;
  }

  const owner = await prisma.user.findFirst({
    where: { investorId: conflicting.id, NOT: { id: currentUserId } },
    select: { id: true }
  });

  if (!owner) {
    return null;
  }

  return { investorId: conflicting.id, ownerUserId: owner.id };
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
