import { prisma, Prisma, type PaymentMethod } from '@sanova/database';
import { ethers } from 'ethers';
import { assertInvestorCheckoutEligible, ensureInvestorForUser, getUserPurchaseContext } from '../investor/investorService';
import {
  checkoutBaseUrl,
  paymentGatewayConfigured,
  paymentMinimumConfirmations,
  paymentOrderTtlMinutes,
  usdcDecimals
} from './paymentConfig';
import { isCheckoutMethodConfigured } from './checkoutMethods';
import {
  createCoinbaseCartCheckout,
  createMercadoPagoCartCheckout,
  createStripeCartCheckout
} from './paymentGatewayAdapters';
import { createBridgeOnRampCheckout, createTransakOnRampCheckout } from './paymentOnRampAdapters';
import { assertPaymentCircuitOpen, assertPaymentLimits } from './paymentLimits';
import { scorePaymentRisk } from './paymentRisk';
import { resolveInvestorLinkedWallet } from '../investor/linkedWalletPolicy';
import { confirmPaymentIntent, type PublicPaymentIntent } from './paymentService';
import { assertPaymentProofPresent, assertTokenizedPurchaseReady } from './purchaseGuard';
import { recordPortfolioSnapshot } from '../portfolio/portfolioAggregator';
import { getStablecoinNetwork, requireBaseStablecoinNetwork, type StablecoinNetwork } from './stablecoinNetworks';

const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from,address indexed to,uint256 value)'];

export type CartLineInput = {
  projectId: string;
  tokenCount: number;
};

export type CartCheckoutResult = {
  batchId: string;
  mode: 'purchase';
  totalUsd: string;
  totalTokens: number;
  method: PaymentMethod;
  paymentIntents: PublicPaymentIntent[];
  providerCheckoutUrl: string | null;
  payToAddress: string | null;
  stablecoinNetwork: string | null;
  confirmed: boolean;
};

function normalizeAddress(address?: string | null, network?: StablecoinNetwork): string | null {
  if (!address?.trim()) {
    return null;
  }
  if (network && network.kind !== 'EVM') {
    return address.trim();
  }
  return ethers.getAddress(address.trim()).toLowerCase();
}

function serializeIntent(intent: {
  id: string;
  method: PaymentMethod;
  status: string;
  tokenCount: number;
  amountUsd: Prisma.Decimal;
  currency: string;
  stablecoinSymbol: string | null;
  chainId: number | null;
  payerWalletAddress: string | null;
  payToAddress: string | null;
  txHash: string | null;
  provider: string | null;
  providerCheckoutUrl: string | null;
  expiresAt: Date;
  confirmedAt: Date | null;
  metadata: Prisma.JsonValue;
}): PublicPaymentIntent {
  return {
    ...intent,
    status: intent.status as PublicPaymentIntent['status'],
    amountUsd: intent.amountUsd.toString(),
    expiresAt: intent.expiresAt.toISOString(),
    confirmedAt: intent.confirmedAt?.toISOString() ?? null
  };
}

export async function loadCartBatchIntents(userId: string, batchId: string) {
  const intents = await prisma.paymentIntent.findMany({
    where: {
      userId,
      status: { in: ['PENDING', 'REQUIRES_PAYMENT', 'MANUAL_REVIEW'] }
    },
    orderBy: { createdAt: 'asc' }
  });

  return intents.filter((intent) => {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    return metadata.cartBatchId === batchId;
  });
}

export async function loadCartBatchIntentsAnyStatus(userId: string, batchId: string) {
  const intents = await prisma.paymentIntent.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });

  return intents.filter((intent) => {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    return metadata.cartBatchId === batchId;
  });
}

async function attachCartGatewayCheckout(input: {
  batchId: string;
  method: PaymentMethod;
  totalUsd: number;
  totalTokens: number;
  primaryProjectId: string;
  paymentIntentIds: string[];
  userEmail?: string | null;
  stablecoinNetwork?: string | null;
}) {
  const redirectPath = `/marketplace/carrito?batch=${encodeURIComponent(input.batchId)}&status=success`;

  if (input.method === 'STRIPE') {
    return createStripeCartCheckout(input);
  }
  if (input.method === 'MERCADO_PAGO') {
    return createMercadoPagoCartCheckout(input);
  }
  if (input.method === 'COINBASE') {
    return createCoinbaseCartCheckout(input);
  }
  if (input.method === 'TRANSAK') {
    return createTransakOnRampCheckout({
      depositId: input.batchId,
      amountUsd: input.totalUsd,
      stablecoinNetwork: input.stablecoinNetwork,
      userEmail: input.userEmail,
      redirectPath
    });
  }
  if (input.method === 'BRIDGE') {
    return createBridgeOnRampCheckout({
      depositId: input.batchId,
      amountUsd: input.totalUsd,
      stablecoinNetwork: input.stablecoinNetwork,
      redirectPath
    });
  }
  if (input.method === 'RAMP') {
    return createTransakOnRampCheckout({
      depositId: input.batchId,
      amountUsd: input.totalUsd,
      stablecoinNetwork: input.stablecoinNetwork,
      userEmail: input.userEmail,
      redirectPath
    });
  }

  return null;
}

export async function createCartPurchaseCheckout(input: {
  userId: string;
  userEmail?: string | null;
  items: CartLineInput[];
  method: PaymentMethod;
  walletAddress?: string | null;
  stablecoinNetwork?: string | null;
}): Promise<CartCheckoutResult> {
  if (!input.items.length) {
    throw new Error('CART_EMPTY');
  }

  if (!isCheckoutMethodConfigured(input.method)) {
    throw new Error('PAYMENT_METHOD_NOT_CONFIGURED');
  }

  const user = await getUserPurchaseContext(input.userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  assertInvestorCheckoutEligible(user);

  const network =
    input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN'
      ? requireBaseStablecoinNetwork(input.stablecoinNetwork)
      : getStablecoinNetwork(input.stablecoinNetwork);

  let payerWallet: string | null = null;
  if (input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN') {
    payerWallet = await resolveInvestorLinkedWallet(input.userId, input.walletAddress);
    if (!payerWallet) {
      throw new Error('WALLET_REQUIRED');
    }
  } else if (input.walletAddress) {
    payerWallet = normalizeAddress(input.walletAddress, network);
  }

  const investorId =
    user.investorId ?? (payerWallet ? await ensureInvestorForUser(user, payerWallet) : user.investorId);
  if (!investorId && input.method === 'INTERNAL_BALANCE') {
    throw new Error('INVESTOR_WALLET_REQUIRED');
  }

  const batchId = `cart-${input.userId}-${Date.now().toString(36)}`;
  const expiresAt = new Date(Date.now() + paymentOrderTtlMinutes() * 60_000);
  const payToAddress =
    input.method === 'CUSTODIAL_STABLECOIN'
      ? process.env.STABLECOIN_CUSTODIAL_WALLET_ADDRESS?.trim() || network.treasuryAddress
      : input.method === 'USDC_ONCHAIN'
        ? network.treasuryAddress
        : null;

  const createdIntents = await prisma.$transaction(async (tx) => {
    const rows = [];

    for (const [index, line] of input.items.entries()) {
      await assertPaymentCircuitOpen(line.projectId);

      const project = await tx.project.findUnique({ where: { id: line.projectId } });
      if (!project || !project.isActive) {
        throw new Error('PROJECT_NOT_AVAILABLE');
      }
      if (!Number.isInteger(line.tokenCount) || line.tokenCount <= 0) {
        throw new Error('INVALID_TOKEN_COUNT');
      }
      if (project.availableTokens < line.tokenCount) {
        throw new Error('INSUFFICIENT_SUPPLY');
      }

      const amountUsd = project.pricePerToken.toNumber() * line.tokenCount;
      await assertPaymentLimits({
        userId: input.userId,
        projectId: line.projectId,
        walletAddress: payerWallet,
        amountUsd
      });

      const risk = await scorePaymentRisk({
        userId: input.userId,
        projectId: line.projectId,
        amountUsd,
        walletAddress: payerWallet,
        method: input.method
      });

      const idempotencyKey = `${batchId}:${line.projectId}:${line.tokenCount}:${input.method}`;

      const intent = await tx.paymentIntent.create({
        data: {
          userId: input.userId,
          investorId,
          projectId: line.projectId,
          method: input.method,
          status: risk.requiresManualReview ? 'MANUAL_REVIEW' : 'REQUIRES_PAYMENT',
          tokenCount: line.tokenCount,
          amountUsd,
          currency: 'USD',
          stablecoinSymbol:
            input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN' ? network.symbol : null,
          chainId: input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN' ? network.chainId : null,
          payerWalletAddress: payerWallet,
          payToAddress,
          idempotencyKey,
          expiresAt,
          metadata: {
            cartBatchId: batchId,
            cartLineIndex: index,
            projectTitle: project.title,
            pricePerTokenUsd: project.pricePerToken.toString(),
            purchaseMode: 'CART_TREASURY_TRANSFER',
            stablecoinNetwork: network.id,
            treasuryAddress: payToAddress
          } as Prisma.InputJsonObject
        }
      });

      rows.push(intent);
    }

    return rows;
  });

  const totalUsd = createdIntents.reduce((sum, row) => sum + row.amountUsd.toNumber(), 0);
  const totalTokens = createdIntents.reduce((sum, row) => sum + row.tokenCount, 0);
  const paymentIntentIds = createdIntents.map((row) => row.id);

  let providerCheckoutUrl: string | null = null;

  if (input.method === 'INTERNAL_BALANCE') {
    await confirmCartPurchaseBatch({
      userId: input.userId,
      batchId,
      provider: 'internal_balance',
      providerPaymentId: `cart-internal-${batchId}`
    });

    const confirmed = await loadCartBatchIntentsAnyStatus(input.userId, batchId);
    return {
      batchId,
      mode: 'purchase',
      totalUsd: totalUsd.toFixed(6),
      totalTokens,
      method: input.method,
      paymentIntents: confirmed.map(serializeIntent),
      providerCheckoutUrl: null,
      payToAddress,
      stablecoinNetwork: network.id,
      confirmed: true
    };
  }

  const gateway = await attachCartGatewayCheckout({
    batchId,
    method: input.method,
    totalUsd,
    totalTokens,
    primaryProjectId: input.items[0].projectId,
    paymentIntentIds,
    userEmail: input.userEmail,
    stablecoinNetwork: network.id
  });

  if (gateway?.providerCheckoutUrl) {
    providerCheckoutUrl = gateway.providerCheckoutUrl;
    await prisma.paymentIntent.updateMany({
      where: { id: { in: paymentIntentIds } },
      data: {
        provider: gateway.provider,
        providerPaymentId: gateway.providerPaymentId,
        providerCheckoutUrl: gateway.providerCheckoutUrl
      }
    });
  }

  const fresh = await loadCartBatchIntents(input.userId, batchId);

  return {
    batchId,
    mode: 'purchase',
    totalUsd: totalUsd.toFixed(6),
    totalTokens,
    method: input.method,
    paymentIntents: fresh.map(serializeIntent),
    providerCheckoutUrl,
    payToAddress,
    stablecoinNetwork: network.id,
    confirmed: false
  };
}

export async function confirmCartPurchaseBatch(input: {
  userId: string;
  batchId: string;
  txHash?: string | null;
  provider?: string | null;
  providerPaymentId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  const intents = await loadCartBatchIntents(input.userId, input.batchId);
  if (!intents.length) {
    throw new Error('CART_BATCH_NOT_FOUND');
  }

  if (intents[0].method === 'INTERNAL_BALANCE') {
    const account = await prisma.platformWalletAccount.findUnique({
      where: { userId_currency: { userId: input.userId, currency: 'USD' } }
    });
    const totalUsd = intents.reduce((sum, row) => sum + row.amountUsd.toNumber(), 0);
    if (!account || account.balance.minus(account.reserved).lessThan(totalUsd)) {
      throw new Error('INSUFFICIENT_PLATFORM_BALANCE');
    }
  }

  const results = [];
  for (const intent of intents) {
    const project = await prisma.project.findUnique({ where: { id: intent.projectId } });
    if (project) {
      await assertTokenizedPurchaseReady({
        project,
        projectId: intent.projectId,
        walletAddress: intent.payerWalletAddress
      });
    }

    assertPaymentProofPresent(intent, {
      txHash: input.txHash,
      providerPaymentId: input.providerPaymentId
    });

    const confirmed = await confirmPaymentIntent({
      paymentIntentId: intent.id,
      txHash: input.txHash,
      provider: input.provider ?? intent.provider,
      providerPaymentId: input.providerPaymentId ?? intent.providerPaymentId,
      payload: {
        ...(typeof input.payload === 'object' && input.payload !== null ? input.payload : {}),
        cartBatchId: input.batchId
      } as Prisma.InputJsonValue
    });
    results.push(confirmed);
  }

  try {
    await recordPortfolioSnapshot(input.userId);
  } catch {
    // non-blocking
  }

  return results;
}

export async function verifyCartUsdcPayment(input: {
  userId: string;
  batchId: string;
  txHash: string;
  expectedPayer?: string | null;
}) {
  const intents = await loadCartBatchIntents(input.userId, input.batchId);
  if (!intents.length) {
    throw new Error('CART_BATCH_NOT_FOUND');
  }
  if (intents.some((row) => row.method !== 'USDC_ONCHAIN')) {
    throw new Error('INVALID_PAYMENT_METHOD');
  }

  const first = intents[0];
  const metadata = (first.metadata as Record<string, unknown>) ?? {};
  const network = getStablecoinNetwork(String(metadata.stablecoinNetwork ?? 'BASE'));
  const rpcUrl = network.rpcUrl;
  const usdcAddress = network.tokenAddress;
  const treasuryAddress = network.treasuryAddress;
  const totalUsd = intents.reduce((sum, row) => sum + row.amountUsd.toNumber(), 0);

  if (!rpcUrl || !usdcAddress || !treasuryAddress) {
    throw new Error('USDC_PAYMENT_NOT_CONFIGURED');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(input.txHash);
  if (!receipt || receipt.status !== 1) {
    provider.destroy();
    throw new Error('TX_NOT_CONFIRMED');
  }

  const evmNetwork = await provider.getNetwork();
  if (Number(evmNetwork.chainId) !== first.chainId) {
    provider.destroy();
    throw new Error('CHAIN_MISMATCH');
  }

  const confirmations = (await provider.getBlockNumber()) - receipt.blockNumber + 1;
  if (confirmations < paymentMinimumConfirmations()) {
    provider.destroy();
    throw new Error('TX_CONFIRMATIONS_PENDING');
  }

  const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
  const expectedTo = ethers.getAddress(treasuryAddress);
  const expectedFrom = normalizeAddress(input.expectedPayer ?? first.payerWalletAddress);
  const expectedAmount = ethers.parseUnits(totalUsd.toFixed(6), network.decimals ?? usdcDecimals());

  const matchingLog = receipt.logs
    .filter((log) => log.address.toLowerCase() === usdcAddress.toLowerCase())
    .find((log) => {
      if (log.topics[0] !== USDC_TRANSFER_TOPIC) {
        return false;
      }
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (!parsed) {
        return false;
      }
      const from = ethers.getAddress(parsed.args.from as string).toLowerCase();
      const to = ethers.getAddress(parsed.args.to as string);
      const value = parsed.args.value as bigint;
      return to === expectedTo && value === expectedAmount && (!expectedFrom || from === expectedFrom);
    });

  provider.destroy();

  if (!matchingLog) {
    throw new Error('USDC_TRANSFER_NOT_FOUND');
  }

  return confirmCartPurchaseBatch({
    userId: input.userId,
    batchId: input.batchId,
    txHash: input.txHash,
    provider: 'usdc_onchain',
    payload: {
      txHash: input.txHash,
      totalUsd: totalUsd.toFixed(6),
      treasuryAddress: expectedTo
    }
  });
}

export async function confirmCartBatchByProvider(input: {
  batchId: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  const sample = await prisma.paymentIntent.findFirst({
    where: {
      providerPaymentId: input.providerPaymentId ?? undefined
    }
  });

  const intents = sample
    ? await loadCartBatchIntentsAnyStatus(sample.userId, input.batchId)
    : [];

  const pending = intents.filter((row) => row.status !== 'CONFIRMED');
  if (!pending.length) {
    return [];
  }

  return confirmCartPurchaseBatch({
    userId: pending[0].userId,
    batchId: input.batchId,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    payload: input.payload
  });
}
