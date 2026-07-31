import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { ensureSanovaReceiveWalletForUser } from '../../../../../lib/investor/sanovaReceiveWallet';
import { isPrivyEnabled } from '../../../../../lib/privy/config';

export const dynamic = 'force-dynamic';

/**
 * Self-service embedded wallet provisioning — entirely server-side (Privy
 * REST API + PRIVY_APP_SECRET), no Privy client SDK login involved.
 *
 * Returns the canonical Sanova USDC receive address for the investor, after
 * reconciling Privy email wallets vs the linked server wallet.
 */
export async function POST() {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isPrivyEnabled()) {
    return NextResponse.json({ error: 'PRIVY_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const result = await ensureSanovaReceiveWalletForUser(ctx.userId);
    if (!result) {
      return NextResponse.json({ error: 'PRIVY_PROVISION_FAILED' }, { status: 503 });
    }

    return NextResponse.json({
      walletAddress: result.walletAddress,
      walletProvider: result.walletProvider,
      source: result.source,
      reconciled: result.reconciled
    });
  } catch (error) {
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
