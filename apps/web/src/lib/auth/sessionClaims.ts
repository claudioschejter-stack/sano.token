import { prisma } from '@sanova/database';
import { isAccountOperational } from '../onboarding/accountStatus';
import { resolveOperationalWalletAddress } from '../investor/provisionInvestorProfile';
import { is2faLocked, issueTempTotpToken, lockoutRemainingSeconds } from './totpService';

export type SessionAuthClaims = {
  accessToken?: string;
  role?: string;
  roles?: string[];
  accountOperational?: boolean;
  totpPending?: boolean;
  pendingTotpToken?: string;
  authError?: string;
};

export class OAuthTotpLockedError extends Error {
  readonly remainingSeconds: number;

  constructor(remainingSeconds: number) {
    super('CUENTA_BLOQUEADA');
    this.remainingSeconds = remainingSeconds;
  }
}

export async function loadAccountOperational(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      kycStatus: true,
      accountStatus: true,
      walletAddress: true,
      systemRole: true,
      totpEnabled: true,
      investor: { select: { walletAddress: true } }
    }
  });

  if (!user) {
    return false;
  }

  // Some investors only have their wallet stored on the `investor` relation
  // rather than `user.walletAddress` directly. Resolving it the same way as
  // `/api/onboarding/status` and `requireInvestorPortalPage` keeps the JWT's
  // `accountOperational` flag in agreement with the DB-truth checklist, so a
  // fully onboarded user isn't bounced to /kyc right after logging in.
  const walletAddress = resolveOperationalWalletAddress(user.walletAddress, user.investor?.walletAddress);

  return isAccountOperational({ ...user, walletAddress });
}

/**
 * After OAuth identity is verified, either issue a full session or defer to TOTP
 * (same policy as password login step1 + passkey verify).
 */
export async function applyOAuthTotpGate(
  userId: string,
  session: Omit<SessionAuthClaims, 'totpPending' | 'pendingTotpToken' | 'accountOperational'> & {
    accessToken: string;
  }
): Promise<SessionAuthClaims> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, locked2faUntil: true }
  });

  if (user?.totpEnabled) {
    if (is2faLocked(user)) {
      throw new OAuthTotpLockedError(lockoutRemainingSeconds(user));
    }

    const pendingTotpToken = await issueTempTotpToken(userId);
    return {
      role: session.role,
      roles: session.roles,
      totpPending: true,
      pendingTotpToken,
      accountOperational: false
    };
  }

  const accountOperational = await loadAccountOperational(userId);

  return {
    accessToken: session.accessToken,
    role: session.role,
    roles: session.roles,
    accountOperational,
    totpPending: false
  };
}
