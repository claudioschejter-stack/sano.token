import { prisma, type Prisma } from '@sanova/database';
import { getAddress } from 'ethers';
import { isPrivyEnabled, privyAppId } from '../privy/config';

export type PrivyFundingInput = {
  userId: string;
  amountUsd: number;
  provider: string;
  providerPaymentId?: string | null;
  externalReference: string;
  treasuryTxnHash?: string | null;
};

/**
 * After dLocal (or fiat rail) webhook confirms payment, credit USDC to the
 * investor's Privy embedded wallet on Base. Production path uses treasury
 * settlement + on-chain transfer; this service records intent and triggers
 * client-side completion when auto-transfer is not yet wired server-side.
 */
export async function fundPrivyWalletAfterFiatPayment(input: PrivyFundingInput) {
  if (!isPrivyEnabled()) {
    return { ok: false, ignored: 'privy_not_configured' };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      kycStatus: true,
      walletAddress: true,
      walletProvider: true
    }
  });

  if (!user || user.kycStatus !== 'APPROVED') {
    return { ok: false, ignored: 'kyc_not_approved' };
  }

  if (!user.walletAddress?.trim()) {
    return { ok: false, ignored: 'privy_wallet_not_linked' };
  }

  const walletAddress = getAddress(user.walletAddress).toLowerCase();
  const isPrivyWallet = user.walletProvider?.toLowerCase().includes('privy') ?? false;

  if (!isPrivyWallet) {
    return { ok: false, ignored: 'not_privy_wallet' };
  }

  const fundingRecord = {
    policy: 'dlocal_to_usdc_base',
    amountUsd: input.amountUsd,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    externalReference: input.externalReference,
    treasuryTxnHash: input.treasuryTxnHash,
    targetWallet: walletAddress,
    privyAppId: privyAppId(),
    status: input.treasuryTxnHash ? 'settled_on_chain' : 'awaiting_usdc_transfer',
    fundedAt: new Date().toISOString()
  };

  const intents = await prisma.paymentIntent.findMany({
    where: {
      OR: [
        { metadata: { path: ['cartBatchId'], equals: input.externalReference } },
        { id: input.externalReference }
      ]
    },
    select: { id: true, metadata: true }
  });

  for (const intent of intents) {
    const prior = (intent.metadata as Record<string, unknown>) ?? {};
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        metadata: {
          ...prior,
          privyWalletFunding: fundingRecord
        } as Prisma.InputJsonObject
      }
    });
  }

  return {
    ok: true,
    walletAddress,
    funding: fundingRecord,
    nextStep: input.treasuryTxnHash
      ? 'confirm_cart_batch'
      : 'await_treasury_usdc_then_credit_wallet'
  };
}

/** Resolve userId from payment intent metadata for webhook dispatch. */
export async function resolveUserIdFromPaymentReference(reference: string): Promise<string | null> {
  const intent = await prisma.paymentIntent.findFirst({
    where: {
      OR: [
        { id: reference },
        { metadata: { path: ['cartBatchId'], equals: reference } }
      ]
    },
    select: { userId: true }
  });

  return intent?.userId ?? null;
}
