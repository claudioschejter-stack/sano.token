import { prisma, Prisma, type PaymentMethod, type PlatformDepositStatus } from '@sanova/database';
import { ethers } from 'ethers';
import { assertInvestorCheckoutEligible, ensureInvestorForUser, getUserPurchaseContext } from '../investor/investorService';
import { paymentMinimumConfirmations, paymentOrderTtlMinutes } from './paymentConfig';
import { getPaymentCheckoutRowById } from './depositPaymentOptions';
import { createDepositProviderCheckout } from './paymentOnRampAdapters';
import { resolveInvestorLinkedWallet } from '../investor/linkedWalletPolicy';
import { getStablecoinNetwork } from './stablecoinNetworks';
import { resolvePaymentCountryForUser } from './paymentCountry';
import { isLocalRailManualResult, isRipioOnRampResult } from './stripeCheckoutOptions';
import type { PaymentRouteQuote } from './cheapestPaymentRouter';

const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from,address indexed to,uint256 value)'];

type WalletAccount = {
  id: string;
  userId: string;
  investorId: string | null;
  currency: string;
  balance: Prisma.Decimal;
};

export async function getOrCreatePlatformWalletAccount(userId: string, investorId?: string | null, currency = 'USD') {
  return prisma.platformWalletAccount.upsert({
    where: { userId_currency: { userId, currency } },
    create: { userId, investorId, currency },
    update: investorId ? { investorId } : {}
  });
}

export async function getPlatformWalletSummary(userId: string) {
  const account = await getOrCreatePlatformWalletAccount(userId);
  const ledger = await prisma.platformWalletLedgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 25
  });
  const deposits = await prisma.platformDeposit.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  const withdrawals = await prisma.platformWithdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  return {
    account: {
      id: account.id,
      currency: account.currency,
      balance: account.balance.toString(),
      reserved: account.reserved.toString(),
      available: account.balance.minus(account.reserved).toString(),
      status: account.status
    },
    ledger: ledger.map((entry) => ({
      id: entry.id,
      type: entry.type,
      status: entry.status,
      amount: entry.amount.toString(),
      currency: entry.currency,
      balanceAfter: entry.balanceAfter.toString(),
      createdAt: entry.createdAt.toISOString(),
      metadata: entry.metadata
    })),
    deposits: deposits.map((deposit) => ({
      id: deposit.id,
      status: deposit.status,
      amountUsd: deposit.amountUsd.toString(),
      method: deposit.method,
      stablecoinNetwork: deposit.stablecoinNetwork,
      payToAddress: deposit.payToAddress,
      providerCheckoutUrl: deposit.providerCheckoutUrl,
      txHash: deposit.txHash,
      expiresAt: deposit.expiresAt.toISOString(),
      createdAt: deposit.createdAt.toISOString()
    })),
    withdrawals: withdrawals.map((withdrawal) => ({
      id: withdrawal.id,
      status: withdrawal.status,
      amountUsd: withdrawal.amountUsd.toString(),
      method: withdrawal.method,
      stablecoinNetwork: withdrawal.stablecoinNetwork,
      destinationAddress: withdrawal.destinationAddress,
      providerCheckoutUrl: withdrawal.providerCheckoutUrl,
      txHash: withdrawal.txHash,
      createdAt: withdrawal.createdAt.toISOString()
    }))
  };
}

export async function creditPlatformWallet(input: {
  userId: string;
  investorId?: string | null;
  amountUsd: number | Prisma.Decimal;
  idempotencyKey: string;
  depositId?: string | null;
  paymentIntentId?: string | null;
  txHash?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.platformWalletLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) {
      return existing;
    }

    const account = await tx.platformWalletAccount.upsert({
      where: { userId_currency: { userId: input.userId, currency: 'USD' } },
      create: { userId: input.userId, investorId: input.investorId, currency: 'USD' },
      update: input.investorId ? { investorId: input.investorId } : {}
    });

    const amount = new Prisma.Decimal(input.amountUsd);
    const nextBalance = account.balance.plus(amount);

    await tx.platformWalletAccount.update({
      where: { id: account.id },
      data: { balance: nextBalance }
    });

    return tx.platformWalletLedgerEntry.create({
      data: {
        accountId: account.id,
        userId: input.userId,
        investorId: input.investorId,
        type: 'DEPOSIT_CREDIT',
        amount,
        currency: 'USD',
        balanceAfter: nextBalance,
        idempotencyKey: input.idempotencyKey,
        depositId: input.depositId,
        paymentIntentId: input.paymentIntentId,
        txHash: input.txHash,
        metadata: input.metadata ?? {}
      }
    });
  });
}

export async function debitPlatformWalletForPurchase(input: {
  userId: string;
  investorId: string;
  amountUsd: number | Prisma.Decimal;
  idempotencyKey: string;
  paymentIntentId?: string | null;
  investmentId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.platformWalletLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) {
      return existing;
    }

    const account = await tx.platformWalletAccount.upsert({
      where: { userId_currency: { userId: input.userId, currency: 'USD' } },
      create: { userId: input.userId, investorId: input.investorId, currency: 'USD' },
      update: { investorId: input.investorId }
    });

    const amount = new Prisma.Decimal(input.amountUsd);
    if (account.balance.minus(account.reserved).lessThan(amount)) {
      throw new Error('INSUFFICIENT_PLATFORM_BALANCE');
    }

    const nextBalance = account.balance.minus(amount);
    await tx.platformWalletAccount.update({
      where: { id: account.id },
      data: { balance: nextBalance }
    });

    return tx.platformWalletLedgerEntry.create({
      data: {
        accountId: account.id,
        userId: input.userId,
        investorId: input.investorId,
        type: 'TOKEN_PURCHASE_DEBIT',
        amount: amount.negated(),
        currency: 'USD',
        balanceAfter: nextBalance,
        idempotencyKey: input.idempotencyKey,
        paymentIntentId: input.paymentIntentId,
        investmentId: input.investmentId,
        metadata: input.metadata ?? {}
      }
    });
  });
}

export async function createPlatformDeposit(input: {
  userId: string;
  amountUsd: number;
  method: PaymentMethod;
  paymentOptionId?: string | null;
  walletAddress?: string | null;
  stablecoinNetwork?: string | null;
  routeQuote?: PaymentRouteQuote;
}) {
  const user = await getUserPurchaseContext(input.userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  assertInvestorCheckoutEligible(user);

  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    throw new Error('INVALID_DEPOSIT_AMOUNT');
  }

  const network = getStablecoinNetwork(input.routeQuote?.stablecoinNetwork ?? input.stablecoinNetwork);

  let payerWallet: string | null = input.walletAddress ?? null;
  if (input.method === 'USDC_ONCHAIN') {
    payerWallet = await resolveInvestorLinkedWallet(input.userId, input.walletAddress);
  }

  const checkoutRow = input.paymentOptionId ? getPaymentCheckoutRowById(input.paymentOptionId) : null;

  const investorId =
    user.investorId ?? (payerWallet ? await ensureInvestorForUser(user, payerWallet) : null);
  const expiresAt = new Date(Date.now() + paymentOrderTtlMinutes() * 60_000);
  const baseIdempotencyKey = `${input.userId}:deposit:${input.method}:${input.paymentOptionId ?? 'default'}:${input.amountUsd}:${payerWallet ?? 'gateway'}:${network.id}`;

  const existing = await prisma.platformDeposit.findFirst({
    where: { idempotencyKey: baseIdempotencyKey }
  });

  const depositMetadata = {
    network: network.id,
    networkKind: network.kind,
    tokenAddress: network.tokenAddress,
    decimals: network.decimals,
    autoTransferSupported: network.kind === 'EVM',
    selectedRoute: input.routeQuote ?? null,
    paymentOptionId: input.paymentOptionId ?? null,
    providerRail: checkoutRow?.providerRail ?? null,
    paymentLabel: checkoutRow?.label ?? null
  };

  const checkoutInput = {
    method: input.method,
    paymentOptionId: input.paymentOptionId ?? checkoutRow?.id,
    amountUsd: input.amountUsd,
    stablecoinNetwork: input.routeQuote?.stablecoinNetwork ?? input.stablecoinNetwork ?? checkoutRow?.stablecoinNetwork,
    userEmail: user.email,
    userId: input.userId,
    walletAddress: payerWallet,
    country: await resolvePaymentCountryForUser(input.userId),
    paymentOptionRail: checkoutRow?.providerRail ?? null
  };

  if (existing?.status === 'PENDING' && existing.expiresAt > new Date()) {
    return attachDepositProviderCheckoutToDeposit(existing, checkoutInput);
  }

  if (existing && ['PENDING', 'EXPIRED', 'FAILED'].includes(existing.status)) {
    const refreshed = await prisma.platformDeposit.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING',
        amountUsd: input.amountUsd,
        expiresAt,
        investorId,
        providerCheckoutUrl: null,
        providerPaymentId: null,
        metadata: depositMetadata as Prisma.InputJsonObject
      }
    });
    return attachDepositProviderCheckoutToDeposit(refreshed, checkoutInput);
  }

  let idempotencyKey = baseIdempotencyKey;
  if (existing) {
    idempotencyKey = `${baseIdempotencyKey}:${Date.now().toString(36)}`;
  }

  const deposit = await prisma.platformDeposit.create({
    data: {
      userId: input.userId,
      investorId,
      amountUsd: input.amountUsd,
      method: input.method,
      status: 'PENDING',
      stablecoinNetwork: input.method === 'USDC_ONCHAIN' ? network.id : null,
      stablecoinSymbol: input.method === 'USDC_ONCHAIN' ? network.symbol : null,
      payerWalletAddress: payerWallet,
      payToAddress: input.method === 'USDC_ONCHAIN' ? network.treasuryAddress : null,
      provider:
        checkoutRow?.provider ??
        input.routeQuote?.provider ??
        (input.method === 'USDC_ONCHAIN' ? 'stablecoin_onchain' : String(input.method).toLowerCase()),
      idempotencyKey,
      expiresAt,
      metadata: depositMetadata as Prisma.InputJsonObject
    }
  });

  return attachDepositProviderCheckoutToDeposit(deposit, checkoutInput);
}

async function attachDepositProviderCheckoutToDeposit(
  deposit: {
    id: string;
    status: PlatformDepositStatus;
    metadata: Prisma.JsonValue;
    provider: string | null;
    providerPaymentId: string | null;
    providerCheckoutUrl: string | null;
  },
  checkoutInput: {
    method: PaymentMethod;
    paymentOptionId?: string | null;
    amountUsd: number;
    stablecoinNetwork?: string | null;
    userEmail: string;
    userId: string;
    walletAddress: string | null;
    country: string;
    paymentOptionRail?: string | null;
  }
) {
  const checkout = await createDepositProviderCheckout({
    depositId: deposit.id,
    method: checkoutInput.method,
    paymentOptionId: checkoutInput.paymentOptionId,
    amountUsd: checkoutInput.amountUsd,
    stablecoinNetwork: checkoutInput.stablecoinNetwork,
    userEmail: checkoutInput.userEmail,
    userId: checkoutInput.userId,
    walletAddress: checkoutInput.walletAddress,
    redirectPath: `/marketplace/carrito?mode=deposit&deposit=${deposit.id}&status=success`,
    country: checkoutInput.country,
    paymentOptionRail: checkoutInput.paymentOptionRail
  });

  if (checkout.providerCheckoutUrl || checkout.providerPaymentId) {
    const manualReview =
      isLocalRailManualResult(checkout.metadata) || isRipioOnRampResult(checkout.metadata);
    const updated = await prisma.platformDeposit.update({
      where: { id: deposit.id },
      data: {
        status: manualReview ? 'MANUAL_REVIEW' : deposit.status === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : 'PENDING',
        provider: checkout.provider,
        providerPaymentId: checkout.providerPaymentId,
        providerCheckoutUrl:
          checkoutInput.paymentOptionId === 'mercadopago_wallet' ? null : (checkout.providerCheckoutUrl ?? null),
        metadata: {
          ...((deposit.metadata as Record<string, unknown>) ?? {}),
          provider: checkout.metadata,
          ripioExternalRef:
            typeof checkout.metadata?.ripioExternalRef === 'string'
              ? checkout.metadata.ripioExternalRef
              : undefined,
          ripioCustomerId:
            typeof checkout.metadata?.ripioCustomerId === 'string'
              ? checkout.metadata.ripioCustomerId
              : undefined,
          fiatPaymentInstructions: checkout.metadata?.fiatPaymentInstructions ?? undefined
        } as Prisma.InputJsonObject
      }
    });
    return serializeDeposit(updated);
  }

  return serializeDeposit(deposit as Parameters<typeof serializeDeposit>[0]);
}

export async function confirmPlatformDeposit(input: {
  depositId: string;
  txHash?: string | null;
  providerPaymentId?: string | null;
  provider?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const deposit = await prisma.platformDeposit.findUnique({
    where: { id: input.depositId }
  });
  if (!deposit) {
    throw new Error('DEPOSIT_NOT_FOUND');
  }
  if (deposit.status === 'CONFIRMED') {
    return serializeDeposit(deposit);
  }
  if (deposit.expiresAt <= new Date()) {
    const expired = await prisma.platformDeposit.update({
      where: { id: deposit.id },
      data: { status: 'EXPIRED' }
    });
    return serializeDeposit(expired);
  }

  const updated = await prisma.platformDeposit.update({
    where: { id: deposit.id },
    data: {
      status: 'CONFIRMED',
      txHash: input.txHash ?? deposit.txHash,
      provider: input.provider ?? deposit.provider,
      providerPaymentId: input.providerPaymentId ?? deposit.providerPaymentId,
      confirmedAt: new Date(),
      metadata: {
        ...((deposit.metadata as Record<string, unknown>) ?? {}),
        confirmation: input.metadata ?? {}
      } as Prisma.InputJsonObject
    }
  });

  await creditPlatformWallet({
    userId: updated.userId,
    investorId: updated.investorId,
    amountUsd: updated.amountUsd,
    idempotencyKey: `deposit-credit:${updated.id}:${input.txHash ?? input.providerPaymentId ?? 'provider'}`,
    depositId: updated.id,
    txHash: input.txHash,
    metadata: input.metadata ?? {}
  });

  return serializeDeposit(updated);
}

export async function getPlatformDepositForUser(input: { userId: string; depositId: string }) {
  const deposit = await prisma.platformDeposit.findFirst({
    where: {
      id: input.depositId,
      userId: input.userId
    }
  });
  if (!deposit) {
    throw new Error('DEPOSIT_NOT_FOUND');
  }
  return serializeDeposit(deposit);
}

export function serializeDeposit(deposit: {
  id: string;
  status: PlatformDepositStatus;
  amountUsd: Prisma.Decimal;
  currency: string;
  method: PaymentMethod;
  stablecoinNetwork: string | null;
  stablecoinSymbol: string | null;
  payerWalletAddress: string | null;
  payToAddress: string | null;
  txHash: string | null;
  provider: string | null;
  providerPaymentId: string | null;
  providerCheckoutUrl: string | null;
  expiresAt: Date;
  confirmedAt: Date | null;
  metadata: Prisma.JsonValue;
}) {
  return {
    ...deposit,
    amountUsd: deposit.amountUsd.toString(),
    expiresAt: deposit.expiresAt.toISOString(),
    confirmedAt: deposit.confirmedAt?.toISOString() ?? null
  };
}

export async function verifyPlatformStablecoinDeposit(input: {
  depositId: string;
  txHash: string;
  expectedPayer?: string | null;
}) {
  const deposit = await prisma.platformDeposit.findUnique({
    where: { id: input.depositId }
  });
  if (!deposit) {
    throw new Error('DEPOSIT_NOT_FOUND');
  }
  if (deposit.method !== 'USDC_ONCHAIN') {
    throw new Error('INVALID_DEPOSIT_METHOD');
  }

  const network = getStablecoinNetwork(deposit.stablecoinNetwork);
  if (!network.rpcUrl || !network.tokenAddress || !network.treasuryAddress) {
    throw new Error('STABLECOIN_DEPOSIT_NOT_CONFIGURED');
  }

  if (network.kind === 'EVM') {
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const receipt = await provider.getTransactionReceipt(input.txHash);
    if (!receipt || receipt.status !== 1) {
      throw new Error('TX_NOT_CONFIRMED');
    }
    const confirmations = (await provider.getBlockNumber()) - receipt.blockNumber + 1;
    if (confirmations < paymentMinimumConfirmations()) {
      throw new Error('TX_CONFIRMATIONS_PENDING');
    }
    const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
    const expectedTo = ethers.getAddress(network.treasuryAddress);
    const expectedFrom = input.expectedPayer ? ethers.getAddress(input.expectedPayer).toLowerCase() : null;
    const expectedAmount = ethers.parseUnits(deposit.amountUsd.toString(), network.decimals);

    const match = receipt.logs
      .filter((log) => log.address.toLowerCase() === network.tokenAddress?.toLowerCase())
      .some((log) => {
        if (log.topics[0] !== USDC_TRANSFER_TOPIC) return false;
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) return false;
        const from = ethers.getAddress(parsed.args.from as string).toLowerCase();
        const to = ethers.getAddress(parsed.args.to as string);
        const value = parsed.args.value as bigint;
        return to === expectedTo && value === expectedAmount && (!expectedFrom || from === expectedFrom);
      });

    if (!match) {
      throw new Error('STABLECOIN_TRANSFER_NOT_FOUND');
    }
  } else {
    const response = await fetch(network.kind === 'TRON'
      ? `${network.rpcUrl}/v1/transactions/${input.txHash}/events`
      : network.rpcUrl, network.kind === 'SOLANA'
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: input.txHash,
              method: 'getTransaction',
              params: [input.txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
            })
          }
        : undefined);
    if (!response.ok) {
      throw new Error('TX_NOT_CONFIRMED');
    }
    const body = JSON.stringify(await response.json());
    if (!body.includes(network.tokenAddress) || !body.includes(network.treasuryAddress)) {
      throw new Error('STABLECOIN_TRANSFER_NOT_FOUND');
    }
  }

  return confirmPlatformDeposit({
    depositId: deposit.id,
    txHash: input.txHash,
    provider: `${network.id.toLowerCase()}_stablecoin`,
    metadata: { network: network.id }
  });
}
