import { NextResponse } from 'next/server';
import { Prisma, prisma } from '@sanova/database';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { linkUserWallet } from '../../../../../lib/investor/walletService';
import { isPrivyEnabled } from '../../../../../lib/privy/config';
import { pregenerateOrFetchPrivyWallet } from '../../../../../lib/privy/privyWalletProvisioning';
import { autoAllowlistInvestorWallet } from '../../../../../lib/blockchain/autoAllowlistInvestorWallet';

export const dynamic = 'force-dynamic';

/**
 * Self-service embedded wallet provisioning — entirely server-side (Privy
 * REST API + PRIVY_APP_SECRET), no Privy client SDK login involved.
 *
 * Why this exists instead of relying on the client-side Privy SDK: without
 * Custom/JWT-based auth configured on Privy (a paid Scale-plan feature we
 * don't use), calling `usePrivy().login()` from the browser pops Privy's own
 * hosted "log in with email" modal — a confusing second login the investor
 * never asked for, on top of the one they already completed with Sanova.
 * Since the wallet is already pre-generated server-side on KYC approval
 * (see `provisionInvestorProfileOnKycApproval`), this endpoint just re-runs
 * that same idempotent lookup/creation for the current session and links it
 * — the browser never talks to Privy directly during onboarding.
 */
export async function POST() {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isPrivyEnabled()) {
    return NextResponse.json({ error: 'PRIVY_NOT_CONFIGURED' }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { email: true, kycStatus: true, emailVerifiedAt: true }
  });

  if (!user) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  if (user.kycStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'KYC_NOT_APPROVED' }, { status: 400 });
  }

  if (!user.emailVerifiedAt) {
    return NextResponse.json({ error: 'EMAIL_VERIFICATION_REQUIRED' }, { status: 403 });
  }

  const address = await pregenerateOrFetchPrivyWallet(user.email);

  if (!address) {
    return NextResponse.json({ error: 'PRIVY_PROVISION_FAILED' }, { status: 503 });
  }

  try {
    const result = await linkUserWallet(ctx.userId, address, 'Privy Wallet');

    void autoAllowlistInvestorWallet(ctx.userId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'WALLET_ALREADY_LINKED' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'DOCUMENT_ALREADY_REGISTERED') {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (
      message === 'USER_NOT_FOUND' ||
      message === 'KYC_NOT_APPROVED' ||
      message === 'ROLE_NOT_ALLOWED' ||
      message === 'INVALID_WALLET' ||
      message === 'WALLET_ALREADY_LINKED' ||
      message === 'EMAIL_VERIFICATION_REQUIRED'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[investor/wallet/provision]', error);
    return NextResponse.json({ error: 'WALLET_LINK_FAILED' }, { status: 500 });
  }
}
