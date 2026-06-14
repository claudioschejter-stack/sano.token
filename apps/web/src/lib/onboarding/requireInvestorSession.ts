import { NextResponse } from 'next/server';
import { auth } from '../../auth';
import type { Session } from 'next-auth';
import {
  assertInvestorCheckoutEligible,
  assertOperationalInvestor,
  getUserPurchaseContext
} from '../investor/investorService';
const INVESTOR_API_ROLES = new Set(['INVESTOR', 'ADVISOR', 'ADVISOR_MANAGER', 'TREASURY']);
const MORPHO_BORROW_API_ROLES = new Set(['INVESTOR', 'ADVISOR', 'ADVISOR_MANAGER']);

export type InvestorSessionContext = {
  userId: string;
  email: string;
  role: string | undefined;
  session: Session;
};

export type InvestorSessionForbidden = {
  forbidden: true;
  error?: string;
};

export type InvestorSessionResult = InvestorSessionContext | InvestorSessionForbidden | null;

type RequireInvestorSessionOptions = {
  /** When true, requires fully operational account (KYC + verified contact). Default for lending. */
  operational?: boolean;
  /** Override allowed roles (default: INVESTOR + TREASURY). */
  allowedRoles?: Set<string>;
};

export async function requireInvestorSession(
  options: RequireInvestorSessionOptions = {}
): Promise<InvestorSessionResult> {
  const session = await auth();

  if (!session?.user?.accessToken) {
    return null;
  }

  const userId = session.user.id;

  if (!userId) {
    return null;
  }

  const allowedRoles = options.allowedRoles ?? INVESTOR_API_ROLES;
  const role = session.user.role;
  if (!role || !allowedRoles.has(role)) {
    return { forbidden: true, error: 'INVESTOR_ROLE_REQUIRED' };
  }

  const user = await getUserPurchaseContext(userId);
  if (!user) {
    return null;
  }

  try {
    if (options.operational) {
      assertOperationalInvestor(user);
    } else {
      assertInvestorCheckoutEligible(user);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FORBIDDEN';
    return { forbidden: true, error: message };
  }

  return {
    userId,
    email: session.user.email ?? user.email,
    role,
    session
  };
}

export function investorSessionForbiddenResponse(ctx: InvestorSessionForbidden) {
  return NextResponse.json({ error: ctx.error ?? 'FORBIDDEN' }, { status: 403 });
}

/** Morpho borrow preview/prepare: operational INVESTOR only (linked Coinbase wallet). */
export async function requireMorphoBorrowSession(): Promise<InvestorSessionResult> {
  return requireInvestorSession({ operational: true, allowedRoles: MORPHO_BORROW_API_ROLES });
}
