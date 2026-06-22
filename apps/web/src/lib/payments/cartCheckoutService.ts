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
  createMercadoPagoCartCheckout
} from './paymentGatewayAdapters';
import { getPaymentCheckoutRowById } from './depositPaymentOptions';
import { createLocalRailCheckout } from './localRailAdapter';
import { createBridgeOnRampCheckout, createPrivyOnRampCheckout, createTransakOnRampCheckout } from './paymentOnRampAdapters';
import { createBinancePayCheckout } from './binancePayAdapter';
import { createRipioOnRampCheckout } from './ripioOnRampAdapter';
import { assertPaymentCircuitOpen, assertPaymentLimits } from './paymentLimits';
import { scorePaymentRisk } from './paymentRisk';
import {
  releaseSupplyForIntent,
  reserveProjectTokens
} from './paymentSupplyReservation';
import { deliverVaultSharesAfterPayment } from './vaultShareDeliveryStatus';
import { resolveInvestorLinkedWallet, getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { confirmPaymentIntentInTx, markPaymentIntentFailed, type PublicPaymentIntent } from './paymentService';
import { assertPaymentProofPresent } from './purchaseGuard';
import { buildPurchaseIntentMetadata } from './purchaseIntentMetadata';
import { readBatchTotalUsdcBaseUnits, sumDecimalUsdBaseUnits } from './paymentAmountUtils';
import { recordPortfolioSnapshot } from '../portfolio/portfolioAggregator';
import {
  resolvePaymentCountryForUser
} from './paymentCountry';
import {
  isErc4626DirectDepositBatch,
  verifyVaultDepositReceipt,
  type ExpectedVaultDeposit
} from '../web3/vaultDepositPayment';
import { getStablecoinNetwork, requireBaseStablecoinNetwork, type StablecoinNetwork } from './stablecoinNetworks';
import { isLocalRailManualResult, isRipioOnRampResult } from './stripeCheckoutOptions';
import {
  isMercadoPagoEmbeddedResult,
  type MercadoPagoEmbeddedSession
} from './mercadoPagoEmbeddedService';

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
  manualReview?: boolean;
  embeddedCheckout?: MercadoPagoEmbeddedSession | null;
};

function embeddedCheckoutFromGateway(metadata: unknown): MercadoPagoEmbeddedSession | null {
  return isMercadoPagoEmbeddedResult(metadata) ? metadata : null;
}

function embeddedCheckoutFromIntents(intents: PublicPaymentIntent[]): MercadoPagoEmbeddedSession | null {
  for (const intent of intents) {
    const metadata = (intent.metadata as Record<string, unknown> | null) ?? {};
    const gateway = metadata.gateway;
    const session = embeddedCheckoutFromGateway(gateway);
    if (session) {
      return session;
    }
  }
  return null;
}

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
  providerPaymentId: string | null;
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

export type CartBatchStatus = {
  found: boolean;
  batchId: string;
  allConfirmed: boolean;
  confirmedCount: number;
  totalCount: number;
  paymentIntents: PublicPaymentIntent[];
};

export async function getCartBatchStatus(
  userId: string,
  batchId: string,
  options?: { sync?: boolean }
): Promise<CartBatchStatus> {
  if (options?.sync) {
    const { syncCartBatchFromProvider } = await import('./paymentProviderSync');
    await syncCartBatchFromProvider({ userId, batchId });
  }

  const intents = await loadCartBatchIntentsAnyStatus(userId, batchId);
  if (!intents.length) {
    return {
      found: false,
      batchId,
      allConfirmed: false,
      confirmedCount: 0,
      totalCount: 0,
      paymentIntents: []
    };
  }

  const confirmedCount = intents.filter((row) => row.status === 'CONFIRMED').length;

  return {
    found: true,
    batchId,
    allConfirmed: confirmedCount === intents.length,
    confirmedCount,
    totalCount: intents.length,
    paymentIntents: intents.map(serializeIntent)
  };
}

function investmentTxHashForBatchLine(onChainTxHash: string | null | undefined, intentId: string): string {
  if (onChainTxHash?.trim()) {
    return `${onChainTxHash.trim()}#${intentId}`;
  }
  return `payment-${intentId}`;
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
  paymentOptionId?: string | null;
  paymentOptionRail?: string | null;
  totalUsd: number;
  totalTokens: number;
  primaryProjectId: string;
  paymentIntentIds: string[];
  userId: string;
  userEmail?: string | null;
  stablecoinNetwork?: string | null;
  country?: string | null;
}) {
  const redirectPath = `/marketplace/carrito?batch=${encodeURIComponent(input.batchId)}&status=success`;
  const checkoutRow = input.paymentOptionId ? getPaymentCheckoutRowById(input.paymentOptionId) : null;

  if (input.method === 'LOCAL_RAIL' && input.paymentOptionId && checkoutRow) {
    return createLocalRailCheckout({
      depositId: input.batchId,
      amountUsd: input.totalUsd,
      row: checkoutRow,
      userEmail: input.userEmail,
      redirectPath,
      country: input.country
    });
  }

  if (input.method === 'BRIDGE') {
    if (checkoutRow?.provider === 'wise') {
      return createLocalRailCheckout({
        depositId: input.batchId,
        amountUsd: input.totalUsd,
        row: checkoutRow,
        userEmail: input.userEmail,
        redirectPath,
        country: input.country
      });
    }
    return createBridgeOnRampCheckout({
      depositId: input.batchId,
      amountUsd: input.totalUsd,
      stablecoinNetwork: 'BASE',
      redirectPath
    });
  }

  if (input.method === 'COINBASE') {
    return createCoinbaseCartCheckout(input);
  }
  if (input.method === 'MERCADO_PAGO') {
    return createMercadoPagoCartCheckout({
      batchId: input.batchId,
      totalUsd: input.totalUsd,
      totalTokens: input.totalTokens,
      paymentIntentIds: input.paymentIntentIds,
      paymentOptionId: input.paymentOptionId ?? checkoutRow?.id ?? null
    });
  }
  if (checkoutRow?.id === 'binance_pay') {
    return createBinancePayCheckout({
      referenceId: input.batchId,
      amountUsd: input.totalUsd,
      redirectPath
    });
  }
  if (input.method === 'TRANSAK') {
    if (checkoutRow?.id === 'privy_on_ramp' || checkoutRow?.provider === 'privy') {
      return createPrivyOnRampCheckout({
        depositId: input.batchId,
        amountUsd: input.totalUsd,
        stablecoinNetwork: 'BASE',
        userEmail: input.userEmail,
        redirectPath,
        country: input.country
      });
    }
    return createTransakOnRampCheckout({
      depositId: input.batchId,
      amountUsd: input.totalUsd,
      stablecoinNetwork: 'BASE',
      userEmail: input.userEmail,
      redirectPath
    });
  }
  if (input.method === 'RIPIO') {
    return createRipioOnRampCheckout({
      depositId: input.batchId,
      amountUsd: input.totalUsd,
      stablecoinNetwork: 'BASE',
      userEmail: input.userEmail,
      userId: input.userId,
      redirectPath,
      paymentOptionRail: input.paymentOptionRail ?? checkoutRow?.providerRail ?? null
    });
  }
  if (input.method === 'RAMP') {
    return {
      provider: 'ramp',
      metadata: { configured: false, reason: 'RAMP_NOT_INTEGRATED' }
    };
  }

  return null;
}

const GATEWAY_CHECKOUT_METHODS = new Set<PaymentMethod>([
  'COINBASE',
  'TRANSAK',
  'RIPIO',
  'BRIDGE',
  'RAMP',
  'MERCADO_PAGO',
  'LOCAL_RAIL'
]);

export async function markCartBatchPaymentFailed(input: {
  userId?: string;
  batchId?: string;
  paymentIntentId?: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  let userId = input.userId;
  let batchId = input.batchId;

  if (input.paymentIntentId) {
    const primary = await prisma.paymentIntent.findUnique({ where: { id: input.paymentIntentId } });
    if (primary) {
      userId = userId ?? primary.userId;
      const metadata = (primary.metadata as Record<string, unknown>) ?? {};
      batchId = batchId ?? (typeof metadata.cartBatchId === 'string' ? metadata.cartBatchId : undefined);
    }
  }

  if (!userId || !batchId) {
    return [];
  }

  const intents = await loadCartBatchIntentsAnyStatus(userId, batchId);
  const results: PublicPaymentIntent[] = [];

  for (const intent of intents) {
    if (intent.status === 'CONFIRMED') {
      continue;
    }

    const failed = await markPaymentIntentFailed({
      paymentIntentId: intent.id,
      provider: input.provider ?? intent.provider,
      providerPaymentId: input.providerPaymentId ?? intent.providerPaymentId,
      payload: {
        ...(typeof input.payload === 'object' && input.payload !== null ? input.payload : {}),
        cartBatchId: batchId
      }
    });

    if (failed) {
      results.push(failed);
    }
  }

  return results;
}

export async function createCartPurchaseCheckout(input: {
  userId: string;
  userEmail?: string | null;
  items: CartLineInput[];
  method: PaymentMethod;
  paymentOptionId?: string | null;
  paymentOptionRail?: string | null;
  walletAddress?: string | null;
  stablecoinNetwork?: string | null;
}): Promise<CartCheckoutResult> {
  if (!input.items.length) {
    throw new Error('CART_EMPTY');
  }

  if (!isCheckoutMethodConfigured(input.method)) {
    throw new Error('PAYMENT_METHOD_NOT_CONFIGURED');
  }

  const checkoutRow = input.paymentOptionId ? getPaymentCheckoutRowById(input.paymentOptionId) : null;

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
  const isWalletConnectCheckout = input.paymentOptionId === 'walletconnect_usdc';
  if (input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN') {
    if (isWalletConnectCheckout) {
      payerWallet = await getLinkedWalletForUser(input.userId);
      if (!payerWallet) {
        throw new Error('INVESTOR_WALLET_REQUIRED');
      }
    } else {
      payerWallet = await resolveInvestorLinkedWallet(input.userId, input.walletAddress);
      if (!payerWallet) {
        throw new Error('WALLET_REQUIRED');
      }
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
    type PlannedLine = {
      index: number;
      line: CartLineInput;
      project: NonNullable<Awaited<ReturnType<typeof tx.project.findUnique>>>;
      amountUsd: Prisma.Decimal;
      risk: Awaited<ReturnType<typeof scorePaymentRisk>>;
    };

    const plannedLines: PlannedLine[] = [];
    let hasVaultDepositMode = false;
    let hasTreasuryTransferMode = false;

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

      const amountUsd = project.pricePerToken.mul(line.tokenCount);
      await assertPaymentLimits({
        userId: input.userId,
        projectId: line.projectId,
        walletAddress: payerWallet,
        amountUsd: amountUsd.toNumber()
      });

      const risk = await scorePaymentRisk({
        userId: input.userId,
        projectId: line.projectId,
        amountUsd: amountUsd.toNumber(),
        walletAddress: payerWallet,
        method: input.method
      });

      const vaultShareDeliveryMode =
        input.method === 'USDC_ONCHAIN' && Boolean(project.vaultAddress?.trim());
      if (vaultShareDeliveryMode) {
        hasVaultDepositMode = true;
      } else if (input.method === 'USDC_ONCHAIN') {
        hasTreasuryTransferMode = true;
      }

      plannedLines.push({ index, line, project, amountUsd, risk });
    }

    if (hasVaultDepositMode && hasTreasuryTransferMode) {
      throw new Error('CART_MIXED_PAYMENT_MODE');
    }

    const batchTotalUsdcBaseUnits = sumDecimalUsdBaseUnits(
      plannedLines.map((row) => ({ amountUsd: row.amountUsd }))
    ).toString();

    const rows = [];
    for (const planned of plannedLines) {
      const { index, line, project, amountUsd, risk } = planned;
      const reserved = await reserveProjectTokens(tx, line.projectId, line.tokenCount);
      if (!reserved) {
        throw new Error('INSUFFICIENT_SUPPLY');
      }

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
          metadata: buildPurchaseIntentMetadata({
            method: input.method,
            tokenCount: line.tokenCount,
            project,
            network,
            payerWallet,
            payToAddress,
            risk: risk as Record<string, unknown>,
            paymentOptionId: input.paymentOptionId ?? checkoutRow?.id ?? null,
            providerRail: checkoutRow?.providerRail ?? null,
            paymentLabel: checkoutRow?.label ?? null,
            cartBatchId: batchId,
            cartLineIndex: index,
            batchTotalUsdcBaseUnits
          })
        }
      });

      rows.push(intent);
    }

    return rows;
  });

  const totalUsdNumber = createdIntents.reduce((sum, row) => sum + row.amountUsd.toNumber(), 0);
  const totalTokens = createdIntents.reduce((sum, row) => sum + row.tokenCount, 0);
  const paymentIntentIds = createdIntents.map((row) => row.id);

  let providerCheckoutUrl: string | null = null;

  if (input.method === 'INTERNAL_BALANCE') {
    if (createdIntents.some((row) => row.status === 'MANUAL_REVIEW')) {
      return {
        batchId,
        mode: 'purchase',
        totalUsd: totalUsdNumber.toFixed(6),
        totalTokens,
        method: input.method,
        paymentIntents: createdIntents.map(serializeIntent),
        providerCheckoutUrl: null,
        payToAddress,
        stablecoinNetwork: network.id,
        confirmed: false,
        manualReview: true
      };
    }

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
      totalUsd: totalUsdNumber.toFixed(6),
      totalTokens,
      method: input.method,
      paymentIntents: confirmed.map(serializeIntent),
      providerCheckoutUrl: null,
      payToAddress,
      stablecoinNetwork: network.id,
      confirmed: true
    };
  }

  if (createdIntents.some((row) => row.status === 'MANUAL_REVIEW')) {
    return {
      batchId,
      mode: 'purchase',
      totalUsd: totalUsdNumber.toFixed(6),
      totalTokens,
      method: input.method,
      paymentIntents: createdIntents.map(serializeIntent),
      providerCheckoutUrl: null,
      payToAddress,
      stablecoinNetwork: network.id,
      confirmed: false,
      manualReview: true
    };
  }

  const paymentCountry = await resolvePaymentCountryForUser(input.userId);

  const gateway = await attachCartGatewayCheckout({
    batchId,
    method: input.method,
    paymentOptionId: input.paymentOptionId ?? checkoutRow?.id,
    paymentOptionRail: input.paymentOptionRail ?? checkoutRow?.providerRail,
    totalUsd: totalUsdNumber,
    totalTokens,
    primaryProjectId: input.items[0].projectId,
    paymentIntentIds,
    userId: input.userId,
    userEmail: input.userEmail,
    stablecoinNetwork: network.id,
    country: paymentCountry
  });

  const gatewayManual = gateway?.metadata && isLocalRailManualResult(gateway.metadata);
  const gatewayOnRamp = gateway?.metadata && isRipioOnRampResult(gateway.metadata);

  if (gatewayManual) {
    for (const intentId of paymentIntentIds) {
      const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
      const prior = (intent?.metadata as Record<string, unknown>) ?? {};
      await prisma.paymentIntent.update({
        where: { id: intentId },
        data: {
          status: 'MANUAL_REVIEW',
          provider: gateway?.provider ?? checkoutRow?.provider,
          providerPaymentId: gateway?.providerPaymentId ?? batchId,
          metadata: {
            ...prior,
            paymentOptionId: input.paymentOptionId ?? checkoutRow?.id ?? null,
            gateway: gateway?.metadata ?? {}
          } as Prisma.InputJsonObject
        }
      });
    }

    const manualIntents = await loadCartBatchIntents(input.userId, batchId);
    return {
      batchId,
      mode: 'purchase',
      totalUsd: totalUsdNumber.toFixed(6),
      totalTokens,
      method: input.method,
      paymentIntents: manualIntents.map(serializeIntent),
      providerCheckoutUrl: null,
      payToAddress,
      stablecoinNetwork: network.id,
      confirmed: false,
      manualReview: true
    };
  }

  if (gatewayOnRamp) {
    providerCheckoutUrl = gateway.providerCheckoutUrl ?? null;

    for (const intentId of paymentIntentIds) {
      const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
      const prior = (intent?.metadata as Record<string, unknown>) ?? {};
      const gatewayMeta = (gateway.metadata ?? {}) as Record<string, unknown>;

      await prisma.paymentIntent.update({
        where: { id: intentId },
        data: {
          status: 'REQUIRES_PAYMENT',
          provider: gateway.provider,
          providerPaymentId: gateway.providerPaymentId ?? batchId,
          providerCheckoutUrl: gateway.providerCheckoutUrl ?? null,
          metadata: {
            ...prior,
            paymentOptionId: input.paymentOptionId ?? checkoutRow?.id ?? null,
            ripioExternalRef:
              typeof gatewayMeta.ripioExternalRef === 'string' ? gatewayMeta.ripioExternalRef : null,
            gateway: gatewayMeta,
            settlementPolicy: 'treasury_first'
          } as Prisma.InputJsonObject
        }
      });
    }

    const onRampIntents = await loadCartBatchIntents(input.userId, batchId);
    return {
      batchId,
      mode: 'purchase',
      totalUsd: totalUsdNumber.toFixed(6),
      totalTokens,
      method: input.method,
      paymentIntents: onRampIntents.map(serializeIntent),
      providerCheckoutUrl,
      payToAddress,
      stablecoinNetwork: network.id,
      confirmed: false,
      manualReview: false
    };
  }

  if (gateway && (gateway.providerCheckoutUrl || gateway.providerPaymentId || isMercadoPagoEmbeddedResult(gateway.metadata))) {
    providerCheckoutUrl = gateway.providerCheckoutUrl ?? null;

    for (const intentId of paymentIntentIds) {
      const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
      const prior = (intent?.metadata as Record<string, unknown>) ?? {};

      await prisma.paymentIntent.update({
        where: { id: intentId },
        data: {
          provider: gateway.provider,
          providerPaymentId: gateway.providerPaymentId,
          providerCheckoutUrl: gateway.providerCheckoutUrl ?? null,
          metadata: {
            ...prior,
            paymentOptionId: input.paymentOptionId ?? checkoutRow?.id ?? null,
            gateway: gateway.metadata ?? {}
          } as Prisma.InputJsonObject
        }
      });
    }
  } else if (GATEWAY_CHECKOUT_METHODS.has(input.method)) {
    await markCartBatchPaymentFailed({
      userId: input.userId,
      batchId,
      paymentIntentId: paymentIntentIds[0],
      provider: gateway?.provider ?? input.method.toLowerCase(),
      payload: {
        reason: 'GATEWAY_UNAVAILABLE',
        gateway: (gateway?.metadata ?? null) as Prisma.InputJsonValue
      }
    });
    throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED');
  }

  const fresh = await loadCartBatchIntents(input.userId, batchId);

  return {
    batchId,
    mode: 'purchase',
    totalUsd: totalUsdNumber.toFixed(6),
    totalTokens,
    method: input.method,
    paymentIntents: fresh.map(serializeIntent),
    providerCheckoutUrl,
    payToAddress,
    stablecoinNetwork: network.id,
    confirmed: false,
    embeddedCheckout: embeddedCheckoutFromIntents(fresh.map(serializeIntent))
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

  if (intents.some((row) => row.status === 'MANUAL_REVIEW')) {
    throw new Error('CART_MANUAL_REVIEW_REQUIRED');
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

  const batchPayload = {
    ...(typeof input.payload === 'object' && input.payload !== null ? input.payload : {}),
    cartBatchId: input.batchId
  } as Prisma.InputJsonValue;

  const confirmedRows = await prisma.$transaction(async (tx) => {
    const results = [];
    const capitalDeltaByInvestor = new Map<string, number>();

    for (const intent of intents) {
      assertPaymentProofPresent(intent, {
        txHash: input.txHash,
        providerPaymentId: input.providerPaymentId
      });

      const investmentTxHash =
        intents.length > 1
          ? investmentTxHashForBatchLine(input.txHash, intent.id)
          : input.txHash?.trim() ||
            input.providerPaymentId?.trim() ||
            `payment-${intent.id}`;

      const confirmed = await confirmPaymentIntentInTx(tx, {
        paymentIntentId: intent.id,
        txHash: input.txHash,
        provider: input.provider ?? intent.provider,
        providerPaymentId: input.providerPaymentId ?? intent.providerPaymentId,
        payload: batchPayload,
        investmentTxHash,
        updateCapitalTotals: false
      });

      if (confirmed.status !== 'CONFIRMED') {
        throw new Error('PAYMENT_INTENT_NOT_PAYABLE');
      }

      if (confirmed.investorId) {
        const prior = capitalDeltaByInvestor.get(confirmed.investorId) ?? 0;
        capitalDeltaByInvestor.set(confirmed.investorId, prior + confirmed.amountUsd.toNumber());
      }

      results.push(confirmed);
    }

    for (const [investorId, deltaUsd] of capitalDeltaByInvestor.entries()) {
      const investor = await tx.investor.findUniqueOrThrow({
        where: { id: investorId },
        select: { totalCapital: true }
      });
      const totalCapital = investor.totalCapital.toNumber() + deltaUsd;

      await tx.investor.update({
        where: { id: investorId },
        data: { totalCapital }
      });

      await tx.portfolio.updateMany({
        where: { userId: input.userId },
        data: { totalCapital }
      });
    }

    return results;
  });

  for (const row of confirmedRows) {
    const eventType =
      row.status === 'CONFIRMED'
        ? 'PAYMENT_CONFIRMED'
        : row.status === 'EXPIRED'
          ? 'PAYMENT_INTENT_EXPIRED'
          : 'PAYMENT_CONFIRMATION_SKIPPED';

    await prisma.paymentEvent.create({
      data: {
        paymentIntentId: row.id,
        type: eventType,
        provider: input.provider ?? row.provider,
        txHash: input.txHash ?? row.txHash,
        payload: batchPayload
      }
    });
  }

  try {
    await recordPortfolioSnapshot(input.userId);
  } catch {
    // non-blocking
  }

  for (const row of confirmedRows) {
    const rowMetadata = (row.metadata as Record<string, unknown>) ?? {};
    if (
      rowMetadata.purchaseMode === 'ERC4626_DEPOSIT' &&
      row.status === 'CONFIRMED' &&
      rowMetadata.vaultShareDeliveryStatus !== 'DELIVERED_ONCHAIN'
    ) {
      try {
        await deliverVaultSharesAfterPayment(row.id);
      } catch (error) {
        console.error('[confirmCartPurchaseBatch] vault share delivery failed', row.id, error);
      }
    }
  }

  const refreshed = await loadCartBatchIntentsAnyStatus(input.userId, input.batchId);
  return refreshed.map(serializeIntent);
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
  const allowedMethods = new Set(['USDC_ONCHAIN', 'CUSTODIAL_STABLECOIN']);
  if (intents.some((row) => !allowedMethods.has(row.method))) {
    throw new Error('INVALID_PAYMENT_METHOD');
  }

  const first = intents[0];
  const metadata = (first.metadata as Record<string, unknown>) ?? {};
  const network = getStablecoinNetwork(String(metadata.stablecoinNetwork ?? 'BASE'));
  const rpcUrl = network.rpcUrl;
  const usdcAddress = network.tokenAddress;
  const treasuryAddress = network.treasuryAddress;
  const totalUsd = intents.reduce((sum, row) => sum + row.amountUsd.toNumber(), 0);
  const tokenDecimals = network.decimals ?? usdcDecimals();
  const expectedAmount = readBatchTotalUsdcBaseUnits(intents, tokenDecimals);

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

  const directVaultDeposit = isErc4626DirectDepositBatch(intents);
  const expectedFrom = normalizeAddress(input.expectedPayer ?? first.payerWalletAddress);

  if (directVaultDeposit) {
    const expectedDeposits: ExpectedVaultDeposit[] = intents.map((row) => {
      const rowMetadata = (row.metadata as Record<string, unknown>) ?? {};
      const vaultAddress = typeof rowMetadata.vaultAddress === 'string' ? rowMetadata.vaultAddress : '';
      if (!vaultAddress) {
        throw new Error('VAULT_NOT_CONFIGURED');
      }
      return {
        vaultAddress,
        amountBaseUnits: ethers.parseUnits(row.amountUsd.toString(), tokenDecimals),
        payerAddress: expectedFrom ?? normalizeAddress(row.payerWalletAddress) ?? ''
      };
    });

    if (expectedDeposits.some((row) => !row.payerAddress)) {
      provider.destroy();
      throw new Error('WALLET_REQUIRED');
    }

    const vaultDepositValid = verifyVaultDepositReceipt({
      receipt,
      usdcTokenAddress: usdcAddress,
      expectedDeposits
    });

    provider.destroy();

    if (!vaultDepositValid) {
      throw new Error('VAULT_DEPOSIT_NOT_FOUND');
    }

    return confirmCartPurchaseBatch({
      userId: input.userId,
      batchId: input.batchId,
      txHash: input.txHash,
      provider: 'usdc_onchain',
      payload: {
        txHash: input.txHash,
        totalUsd: totalUsd.toFixed(6),
        purchaseMode: 'ERC4626_DEPOSIT',
        directVaultDeposit: true,
        vaultShareDeliveryStatus: 'DELIVERED_ONCHAIN'
      }
    });
  }

  const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
  const expectedTo = ethers.getAddress(treasuryAddress);

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
      return to === expectedTo && value >= expectedAmount && (!expectedFrom || from === expectedFrom);
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
      expectedUsdcBaseUnits: expectedAmount.toString(),
      treasuryAddress: expectedTo
    }
  });
}

export async function confirmCartBatchByProvider(input: {
  batchId: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  txHash?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  const blockedFiatProviders = new Set(['mercado_pago', 'stripe']);
  if (input.provider && blockedFiatProviders.has(input.provider)) {
    throw new Error('FIAT_PROVIDER_REQUIRES_TREASURY_USDC');
  }
  let sample = input.providerPaymentId?.trim()
    ? await prisma.paymentIntent.findFirst({
        where: { providerPaymentId: input.providerPaymentId.trim() }
      })
    : null;

  if (!sample) {
    sample = await prisma.paymentIntent.findFirst({
      where: { metadata: { path: ['cartBatchId'], equals: input.batchId } }
    });
  }

  if (!sample) {
    return [];
  }

  const sampleMetadata = (sample.metadata as Record<string, unknown>) ?? {};
  const sampleBatchId = typeof sampleMetadata.cartBatchId === 'string' ? sampleMetadata.cartBatchId : null;
  if (!sampleBatchId || sampleBatchId !== input.batchId) {
    throw new Error('CART_BATCH_MISMATCH');
  }

  const intents = await loadCartBatchIntentsAnyStatus(sample.userId, input.batchId);

  const pending = intents.filter((row) => row.status !== 'CONFIRMED');
  if (!pending.length) {
    return [];
  }

  return confirmCartPurchaseBatch({
    userId: pending[0].userId,
    batchId: input.batchId,
    txHash: input.txHash,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    payload: input.payload
  });
}
