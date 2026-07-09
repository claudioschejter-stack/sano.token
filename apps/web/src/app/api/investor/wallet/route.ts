import { NextResponse } from 'next/server';
import { Prisma, prisma } from '@sanova/database';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { linkUserWallet } from '../../../../lib/investor/walletService';
import { verifyWalletLinkSignature } from '../../../../lib/investor/walletLinkProof';
import { assertWalletLinkChainId, WALLET_LINK_CHAIN_ID } from '../../../../lib/investor/walletLinkChain';
import { isPrivyEnabled } from '../../../../lib/privy/config';
import { syncPrivyEmailVerification } from '../../../../lib/onboarding/syncPrivyEmailVerification';
import { autoAllowlistInvestorWallet } from '../../../../lib/blockchain/autoAllowlistInvestorWallet';

export const dynamic = 'force-dynamic';

/** Privy embedded wallet — no signature required when KYC-approved session provisions wallet. */
export async function POST(request: Request) {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isPrivyEnabled()) {
    return NextResponse.json({ error: 'PRIVY_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      walletAddress?: string;
      walletProvider?: string | null;
      privyProvisioned?: boolean;
      privyAccessToken?: string;
    };

    if (!body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    if (!body.privyProvisioned) {
      return NextResponse.json({ error: 'PRIVY_PROVISION_REQUIRED' }, { status: 400 });
    }

    const privyAccessToken = body.privyAccessToken?.trim();
    if (privyAccessToken) {
      const emailSync = await syncPrivyEmailVerification(ctx.userId, privyAccessToken);
      if (emailSync.reason === 'EMAIL_MISMATCH') {
        return NextResponse.json({ error: 'PRIVY_EMAIL_MISMATCH' }, { status: 400 });
      }
      if (emailSync.reason === 'PRIVY_EMAIL_NOT_VERIFIED') {
        return NextResponse.json({ error: 'PRIVY_EMAIL_NOT_VERIFIED' }, { status: 403 });
      }
    }

    const emailState = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { emailVerifiedAt: true }
    });

    if (!emailState?.emailVerifiedAt) {
      return NextResponse.json({ error: 'EMAIL_VERIFICATION_REQUIRED' }, { status: 403 });
    }

    const result = await linkUserWallet(
      ctx.userId,
      body.walletAddress.trim(),
      body.walletProvider ?? 'Privy Wallet'
    );

    // Auto-whitelist on all active token contracts if KYC already approved
    void autoAllowlistInvestorWallet(ctx.userId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'WALLET_ALREADY_LINKED' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message === 'DOCUMENT_ALREADY_REGISTERED') {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (
      message === 'KYC_NOT_APPROVED' ||
      message === 'INVESTOR_ROLE_REQUIRED' ||
      message === 'ROLE_NOT_ALLOWED' ||
      message === 'INVALID_WALLET' ||
      message === 'WALLET_ALREADY_LINKED' ||
      message === 'PRIVY_TOKEN_INVALID' ||
      message === 'PRIVY_TOKEN_REQUIRED' ||
      message === 'PRIVY_USER_LOOKUP_FAILED' ||
      message === 'EMAIL_VERIFICATION_REQUIRED'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[investor/wallet POST]', error);
    return NextResponse.json({ error: 'WALLET_LINK_FAILED' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      walletAddress?: string;
      walletProvider?: string | null;
      signature?: string;
      issuedAt?: number;
      chainId?: number;
    };

    if (!body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    if (!body.signature?.trim() || body.issuedAt == null) {
      return NextResponse.json({ error: 'WALLET_SIGNATURE_REQUIRED' }, { status: 400 });
    }

    try {
      assertWalletLinkChainId(body.chainId);
    } catch {
      return NextResponse.json({ error: 'CHAIN_MISMATCH' }, { status: 400 });
    }

    const signatureValid = await verifyWalletLinkSignature({
      userId: ctx.userId,
      walletAddress: body.walletAddress.trim(),
      issuedAt: body.issuedAt,
      signature: body.signature.trim(),
      chainId: WALLET_LINK_CHAIN_ID
    });

    if (!signatureValid) {
      return NextResponse.json({ error: 'WALLET_SIGNATURE_INVALID' }, { status: 400 });
    }

    const result = await linkUserWallet(ctx.userId, body.walletAddress, body.walletProvider);

    // Auto-whitelist on all active token contracts if KYC already approved
    void autoAllowlistInvestorWallet(ctx.userId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'WALLET_ALREADY_LINKED' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message === 'DOCUMENT_ALREADY_REGISTERED') {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (
      message === 'KYC_NOT_APPROVED' ||
      message === 'INVESTOR_ROLE_REQUIRED' ||
      message === 'ROLE_NOT_ALLOWED' ||
      message === 'INVALID_WALLET' ||
      message === 'WALLET_ALREADY_LINKED' ||
      message === 'PRIVY_TOKEN_INVALID' ||
      message === 'PRIVY_TOKEN_REQUIRED' ||
      message === 'PRIVY_USER_LOOKUP_FAILED' ||
      message === 'EMAIL_VERIFICATION_REQUIRED'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[investor/wallet PATCH]', error);
    return NextResponse.json({ error: 'WALLET_LINK_FAILED' }, { status: 500 });
  }
}
