import { prisma } from '@sanova/database';
import { isAccountOperational } from '../onboarding/accountStatus';
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
      totpEnabled: true
    }
  });

  if (!user) {
    return false;
  }

  return isAccountOperational(user);
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
