import { NextResponse } from 'next/server';
import { auth } from '../../auth';
import type { Session } from 'next-auth';
import {
  assertInvestorCheckoutEligible,
  assertOperationalInvestor,
  getUserPurchaseContext
} from '../investor/investorService';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';

const INVESTOR_API_ROLES = new Set(['INVESTOR', 'TREASURY']);
const MORPHO_BORROW_API_ROLES = new Set(['INVESTOR', 'TREASURY', 'ADMIN']);

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

  const role = session.user.role;
  if (!role || !INVESTOR_API_ROLES.has(role)) {
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

/** Morpho borrow preview/prepare: INVESTOR/TREASURY (operational) or ADMIN (linked wallet only). */
export async function requireMorphoBorrowSession(): Promise<InvestorSessionResult> {
  const session = await auth();

  if (!session?.user?.accessToken) {
    return null;
  }

  const userId = session.user.id;
  if (!userId) {
    return null;
  }

  const role = session.user.role;
  if (!role || !MORPHO_BORROW_API_ROLES.has(role)) {
    return { forbidden: true, error: 'BORROW_ROLE_REQUIRED' };
  }

  const user = await getUserPurchaseContext(userId);
  if (!user) {
    return null;
  }

  try {
    if (role === 'ADMIN') {
      const linked = await getLinkedWalletForUser(userId);
      if (!linked) {
        throw new Error('INVESTOR_WALLET_REQUIRED');
      }
    } else {
      assertOperationalInvestor(user);
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
