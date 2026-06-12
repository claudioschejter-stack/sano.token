import { NextResponse } from 'next/server';
import { Prisma } from '@sanova/database';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { linkUserWallet } from '../../../../lib/investor/walletService';
import { verifyWalletLinkSignature } from '../../../../lib/investor/walletLinkProof';
import { assertWalletLinkChainId, WALLET_LINK_CHAIN_ID } from '../../../../lib/investor/walletLinkChain';

export const dynamic = 'force-dynamic';

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

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'WALLET_ALREADY_LINKED' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (
      message === 'KYC_NOT_APPROVED' ||
      message === 'INVESTOR_ROLE_REQUIRED' ||
      message === 'ROLE_NOT_ALLOWED' ||
      message === 'INVALID_WALLET' ||
      message === 'WALLET_ALREADY_LINKED'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[investor/wallet PATCH]', error);
    return NextResponse.json({ error: 'WALLET_LINK_FAILED' }, { status: 500 });
  }
}
