import { prisma, Prisma, type PaymentIntentStatus, type PaymentMethod } from '@sanova/database';
import { ethers } from 'ethers';
import { assertOperationalInvestor, ensureInvestorForUser, getUserPurchaseContext } from '../investor/investorService';
import {
  custodialWalletAddress,
  paymentGatewayConfigured,
  paymentMinimumConfirmations,
  paymentOrderTtlMinutes,
  stablecoinChainId,
  stablecoinTreasuryAddress,
  usdcDecimals,
  usdcTokenAddress
} from './paymentConfig';
import {
  createCoinbaseCheckout,
  createMercadoPagoCheckout,
  createStripeCheckout
} from './paymentGatewayAdapters';
import { createBridgeOnRampCheckout, createTransakOnRampCheckout } from './paymentOnRampAdapters';
import { assertPaymentCircuitOpen, assertPaymentLimits } from './paymentLimits';
import { scorePaymentRisk } from './paymentRisk';
import { getStablecoinNetwork, type StablecoinNetwork } from './stablecoinNetworks';
import { recordPortfolioSnapshot } from '../portfolio/portfolioAggregator';

const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ERC20_TRANSFER_ABI = [
  'function transfer(address to,uint256 amount) returns (bool)',
  'event Transfer(address indexed from,address indexed to,uint256 value)'
];

export type PublicPaymentIntent = {
  id: string;
  method: PaymentMethod;
  status: PaymentIntentStatus;
  tokenCount: number;
  amountUsd: string;
  currency: string;
  stablecoinSymbol: string | null;
  chainId: number | null;
  payerWalletAddress: string | null;
  payToAddress: string | null;
  txHash: string | null;
  provider: string | null;
  providerCheckoutUrl: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  metadata: Prisma.JsonValue;
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

function serializePaymentIntent(intent: {
  id: string;
  method: PaymentMethod;
  status: PaymentIntentStatus;
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
    amountUsd: intent.amountUsd.toString(),
    expiresAt: intent.expiresAt.toISOString(),
    confirmedAt: intent.confirmedAt?.toISOString() ?? null
  };
}

async function recordPaymentEvent(input: {
  paymentIntentId: string;
  type: string;
  provider?: string | null;
  txHash?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  await prisma.paymentEvent.create({
    data: {
      paymentIntentId: input.paymentIntentId,
      type: input.type,
      provider: input.provider,
      txHash: input.txHash,
      payload: input.payload ?? {}
    }
  });
}

async function attachProviderCheckout(input: {
  intentId: string;
  method: PaymentMethod;
  projectId: string;
  amountUsd: number;
  tokenCount: number;
}) {
  if (input.method === 'STRIPE') {
    return createStripeCheckout({
      paymentIntentId: input.intentId,
      projectId: input.projectId,
      amountUsd: input.amountUsd,
      tokenCount: input.tokenCount
    });
  }

  if (input.method === 'MERCADO_PAGO') {
    return createMercadoPagoCheckout({
      paymentIntentId: input.intentId,
      projectId: input.projectId,
      amountUsd: input.amountUsd,
      tokenCount: input.tokenCount
    });
  }

  if (input.method === 'COINBASE') {
    return createCoinbaseCheckout({
      paymentIntentId: input.intentId,
      projectId: input.projectId,
      amountUsd: input.amountUsd,
      tokenCount: input.tokenCount
    });
  }

  if (input.method === 'TRANSAK') {
    return createTransakOnRampCheckout({
      depositId: input.intentId,
      amountUsd: input.amountUsd
    });
  }

  if (input.method === 'BRIDGE') {
    return createBridgeOnRampCheckout({
      depositId: input.intentId,
      amountUsd: input.amountUsd
    });
  }

  return null;
}

export async function createPaymentIntent(input: {
  userId: string;
  projectId: string;
  tokenCount: number;
  walletAddress?: string | null;
  method: PaymentMethod;
  stablecoinNetwork?: string | null;
}) {
  const user = await getUserPurchaseContext(input.userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  assertOperationalInvestor(user);

  if (!Number.isInteger(input.tokenCount) || input.tokenCount <= 0) {
    throw new Error('INVALID_TOKEN_COUNT');
  }

  if (!paymentGatewayConfigured(input.method)) {
    throw new Error('PAYMENT_METHOD_NOT_CONFIGURED');
  }

  const network = getStablecoinNetwork(input.stablecoinNetwork);
  const payerWallet = normalizeAddress(input.walletAddress, network);
  if ((input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN') && !payerWallet) {
    throw new Error('WALLET_REQUIRED');
  }

  const investorId = user.investorId ?? (payerWallet ? await ensureInvestorForUser(user, payerWallet) : null);
  if (input.method === 'INTERNAL_BALANCE' && !investorId) {
    throw new Error('INVESTOR_WALLET_REQUIRED');
  }
  const expiresAt = new Date(Date.now() + paymentOrderTtlMinutes() * 60_000);
  const chainId = network.chainId ?? stablecoinChainId();
  const payToAddress =
    input.method === 'CUSTODIAL_STABLECOIN' ? custodialWalletAddress() : network.treasuryAddress;
  await assertPaymentCircuitOpen(input.projectId);

  const intent = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: input.projectId }
    });

    if (!project || !project.isActive) {
      throw new Error('PROJECT_NOT_AVAILABLE');
    }

    if (project.availableTokens < input.tokenCount) {
      throw new Error('INSUFFICIENT_SUPPLY');
    }

    const amountUsd = project.pricePerToken.toNumber() * input.tokenCount;
    await assertPaymentLimits({
      userId: input.userId,
      projectId: input.projectId,
      walletAddress: payerWallet,
      amountUsd
    });
    const risk = await scorePaymentRisk({
      userId: input.userId,
      projectId: input.projectId,
      amountUsd,
      walletAddress: payerWallet,
      method: input.method
    });
    const idempotencyKey = `${input.userId}:${input.projectId}:${input.method}:${input.tokenCount}:${payerWallet ?? 'gateway'}`;

    const existing = await tx.paymentIntent.findUnique({
      where: { idempotencyKey }
    });

    if (existing && ['PENDING', 'REQUIRES_PAYMENT'].includes(existing.status) && existing.expiresAt > new Date()) {
      return existing;
    }

    if (existing && existing.status === 'CONFIRMED') {
      return existing;
    }

    return tx.paymentIntent.create({
      data: {
        userId: input.userId,
        investorId,
        projectId: input.projectId,
        method: input.method,
        status: risk.requiresManualReview ? 'MANUAL_REVIEW' : 'REQUIRES_PAYMENT',
        tokenCount: input.tokenCount,
        amountUsd,
        currency: 'USD',
        stablecoinSymbol: input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN' ? network.symbol : null,
        chainId: input.method === 'USDC_ONCHAIN' || input.method === 'CUSTODIAL_STABLECOIN' ? network.chainId : null,
        payerWalletAddress: payerWallet,
        payToAddress,
        idempotencyKey,
        expiresAt,
        metadata: {
          reservedTokens: input.tokenCount,
          pricePerTokenUsd: project.pricePerToken.toString(),
          configured: paymentGatewayConfigured(input.method),
          risk,
          stablecoinNetwork: network.id,
          stablecoinNetworkLabel: network.label,
          stablecoinNetworkKind: network.kind,
          cheapestRecommendedMethod: 'USDC_ONCHAIN_BASE',
          usdcTokenAddress: input.method === 'USDC_ONCHAIN' ? network.tokenAddress : null,
          usdcDecimals: input.method === 'USDC_ONCHAIN' ? network.decimals : null,
          treasuryAddress: input.method === 'USDC_ONCHAIN' ? network.treasuryAddress : null,
          vaultAddress: project.vaultAddress ?? null,
          purchaseMode:
            input.method === 'USDC_ONCHAIN' && project.vaultAddress ? 'ERC4626_DEPOSIT' : 'TREASURY_TRANSFER',
          autoTransferSupported: network.kind === 'EVM'
        } as Prisma.InputJsonObject
      }
    });
  });

  if (intent.method === 'INTERNAL_BALANCE' && intent.status === 'REQUIRES_PAYMENT') {
    return confirmPaymentIntent({
      paymentIntentId: intent.id,
      provider: 'internal_balance',
      providerPaymentId: `internal-${intent.id}`,
      payload: { source: 'platform_wallet' }
    });
  }

  if (intent.status === 'MANUAL_REVIEW') {
    await recordPaymentEvent({
      paymentIntentId: intent.id,
      type: 'PAYMENT_MANUAL_REVIEW',
      provider: intent.provider,
      payload: {
        reason: 'RISK_SCORE',
        metadata: intent.metadata as Prisma.InputJsonValue
      }
    });
    return serializePaymentIntent(intent);
  }

  const providerCheckout = await attachProviderCheckout({
    intentId: intent.id,
    method: input.method,
    projectId: input.projectId,
    amountUsd: intent.amountUsd.toNumber(),
    tokenCount: input.tokenCount
  });

  const updated =
    providerCheckout && (providerCheckout.providerPaymentId || providerCheckout.providerCheckoutUrl)
      ? await prisma.paymentIntent.update({
          where: { id: intent.id },
          data: {
            provider: providerCheckout.provider,
            providerPaymentId: providerCheckout.providerPaymentId,
            providerCheckoutUrl: providerCheckout.providerCheckoutUrl,
            metadata: {
              ...((intent.metadata as Record<string, unknown>) ?? {}),
              provider: providerCheckout.metadata ?? {}
            } as Prisma.InputJsonObject
          }
        })
      : intent;

  await recordPaymentEvent({
    paymentIntentId: updated.id,
    type: 'PAYMENT_INTENT_CREATED',
    provider: updated.provider,
    payload: {
      method: updated.method,
      tokenCount: updated.tokenCount,
      amountUsd: updated.amountUsd.toString()
    }
  });

  return serializePaymentIntent(updated);
}

export async function getPaymentIntentForUser(userId: string, paymentIntentId: string) {
  const intent = await prisma.paymentIntent.findFirst({
    where: {
      id: paymentIntentId,
      userId
    }
  });

  return intent ? serializePaymentIntent(intent) : null;
}

export async function expirePaymentIntent(paymentIntentId: string) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } });
  if (!intent || intent.status !== 'REQUIRES_PAYMENT' || intent.expiresAt > new Date()) {
    return intent ? serializePaymentIntent(intent) : null;
  }

  const updated = await prisma.paymentIntent.update({
    where: { id: paymentIntentId },
    data: { status: 'EXPIRED' }
  });

  await recordPaymentEvent({
    paymentIntentId,
    type: 'PAYMENT_INTENT_EXPIRED',
    provider: updated.provider
  });

  return serializePaymentIntent(updated);
}

export async function markPaymentIntentFailed(input: {
  paymentIntentId: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: input.paymentIntentId }
  });

  if (!intent || intent.status === 'CONFIRMED') {
    return intent ? serializePaymentIntent(intent) : null;
  }

  const updated = await prisma.paymentIntent.update({
    where: { id: input.paymentIntentId },
    data: {
      status: 'FAILED',
      provider: input.provider ?? intent.provider,
      providerPaymentId: input.providerPaymentId ?? intent.providerPaymentId,
      metadata: {
        ...((intent.metadata as Record<string, unknown>) ?? {}),
        failure: input.payload ?? {}
      }
    }
  });

  await recordPaymentEvent({
    paymentIntentId: updated.id,
    type: 'PAYMENT_FAILED',
    provider: input.provider ?? updated.provider,
    payload: input.payload ?? {}
  });

  return serializePaymentIntent(updated);
}

export async function confirmPaymentIntent(input: {
  paymentIntentId: string;
  txHash?: string | null;
  provider?: string | null;
  providerPaymentId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const intent = await tx.paymentIntent.findUnique({
      where: { id: input.paymentIntentId }
    });

    if (!intent) {
      throw new Error('PAYMENT_INTENT_NOT_FOUND');
    }

    if (intent.status === 'CONFIRMED') {
      return intent;
    }

    if (!['PENDING', 'REQUIRES_PAYMENT'].includes(intent.status)) {
      throw new Error('PAYMENT_INTENT_NOT_PAYABLE');
    }

    if (intent.expiresAt <= new Date()) {
      return tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'EXPIRED' }
      });
    }

    const project = await tx.project.findUnique({
      where: { id: intent.projectId }
    });

    if (!project || !project.isActive) {
      throw new Error('PROJECT_NOT_AVAILABLE');
    }

    if (project.availableTokens < intent.tokenCount) {
      throw new Error('INSUFFICIENT_SUPPLY');
    }

    if (!intent.investorId) {
      throw new Error('INVESTOR_WALLET_REQUIRED');
    }

    if (intent.method === 'INTERNAL_BALANCE') {
      const account = await tx.platformWalletAccount.findUnique({
        where: { userId_currency: { userId: intent.userId, currency: 'USD' } }
      });
      if (!account || account.balance.minus(account.reserved).lessThan(intent.amountUsd)) {
        throw new Error('INSUFFICIENT_PLATFORM_BALANCE');
      }
    }

    const investment = await tx.investment.create({
      data: {
        investorId: intent.investorId,
        projectId: intent.projectId,
        tokenCount: intent.tokenCount,
        purchasePriceUsd: intent.amountUsd,
        status: 'ACTIVE',
        txHash: input.txHash || input.providerPaymentId || `payment-${intent.id}`
      }
    });

    await tx.project.update({
      where: { id: intent.projectId },
      data: {
        availableTokens: project.availableTokens - intent.tokenCount
      }
    });

    const investor = await tx.investor.findUniqueOrThrow({
      where: { id: intent.investorId },
      select: { totalCapital: true, marginDebt: true }
    });

    const totalCapital = investor.totalCapital.toNumber() + intent.amountUsd.toNumber();
    const marginDebt = investor.marginDebt.toNumber();
    const ltv = totalCapital > 0 ? (marginDebt / totalCapital) * 100 : 0;

    await tx.investor.update({
      where: { id: intent.investorId },
      data: {
        totalCapital,
        ltv
      }
    });

    await tx.portfolio.updateMany({
      where: { userId: intent.userId },
      data: {
        totalCapital,
        activeMarginDebt: marginDebt,
        ltv
      }
    });

    if (intent.method === 'INTERNAL_BALANCE') {
      const account = await tx.platformWalletAccount.findUniqueOrThrow({
        where: { userId_currency: { userId: intent.userId, currency: 'USD' } }
      });
      const nextBalance = account.balance.minus(intent.amountUsd);
      await tx.platformWalletAccount.update({
        where: { id: account.id },
        data: { balance: nextBalance }
      });
      await tx.platformWalletLedgerEntry.create({
        data: {
          accountId: account.id,
          userId: intent.userId,
          investorId: intent.investorId,
          type: 'TOKEN_PURCHASE_DEBIT',
          amount: intent.amountUsd.negated(),
          currency: 'USD',
          balanceAfter: nextBalance,
          idempotencyKey: `token-purchase:${intent.id}`,
          paymentIntentId: intent.id,
          investmentId: investment.id,
          metadata: { projectId: intent.projectId, tokenCount: intent.tokenCount }
        }
      });
    }

    return tx.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: 'CONFIRMED',
        investmentId: investment.id,
        txHash: input.txHash ?? intent.txHash,
        provider: input.provider ?? intent.provider,
        providerPaymentId: input.providerPaymentId ?? intent.providerPaymentId,
        confirmedAt: new Date(),
        metadata: {
          ...((intent.metadata as Record<string, unknown>) ?? {}),
          confirmation: input.payload ?? {}
        }
      }
    });
  });

  await recordPaymentEvent({
    paymentIntentId: result.id,
    type: 'PAYMENT_CONFIRMED',
    provider: input.provider ?? result.provider,
    txHash: input.txHash ?? result.txHash,
    payload: input.payload ?? {}
  });

  try {
    await recordPortfolioSnapshot(result.userId);
  } catch (error) {
    console.error('[confirmPaymentIntent] snapshot failed', error);
  }

  return serializePaymentIntent(result);
}

export async function verifyUsdcPayment(input: {
  paymentIntentId: string;
  txHash: string;
  expectedPayer?: string | null;
}) {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: input.paymentIntentId }
  });

  if (!intent) {
    throw new Error('PAYMENT_INTENT_NOT_FOUND');
  }

  if (intent.method !== 'USDC_ONCHAIN') {
    throw new Error('INVALID_PAYMENT_METHOD');
  }

  const metadata = (intent.metadata as Record<string, unknown>) ?? {};
  const network = getStablecoinNetwork(String(metadata.stablecoinNetwork ?? 'BASE'));
  const rpcUrl = network.rpcUrl;
  const usdcAddress = network.tokenAddress ?? usdcTokenAddress();
  const treasuryAddress = network.treasuryAddress ?? stablecoinTreasuryAddress();
  const vaultAddress = typeof metadata.vaultAddress === 'string' ? metadata.vaultAddress : null;
  const purchaseMode =
    metadata.purchaseMode === 'ERC4626_DEPOSIT' && vaultAddress ? 'ERC4626_DEPOSIT' : 'TREASURY_TRANSFER';

  if (!rpcUrl || !usdcAddress || !treasuryAddress) {
    throw new Error('USDC_PAYMENT_NOT_CONFIGURED');
  }

  if (purchaseMode === 'ERC4626_DEPOSIT' && !vaultAddress) {
    throw new Error('VAULT_NOT_CONFIGURED');
  }

  if (network.kind === 'TRON') {
    return verifyTronStablecoinPayment({ intent, txHash: input.txHash, network, expectedPayer: input.expectedPayer });
  }

  if (network.kind === 'SOLANA') {
    return verifySolanaStablecoinPayment({ intent, txHash: input.txHash, network });
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(input.txHash);
  if (!receipt || receipt.status !== 1) {
    throw new Error('TX_NOT_CONFIRMED');
  }

  const evmNetwork = await provider.getNetwork();
  if (Number(evmNetwork.chainId) !== intent.chainId) {
    throw new Error('CHAIN_MISMATCH');
  }

  const confirmations = (await provider.getBlockNumber()) - receipt.blockNumber + 1;
  if (confirmations < paymentMinimumConfirmations()) {
    throw new Error('TX_CONFIRMATIONS_PENDING');
  }

  const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
  const expectedTo = ethers.getAddress(
    purchaseMode === 'ERC4626_DEPOSIT' && vaultAddress ? vaultAddress : treasuryAddress
  );
  const expectedFrom = normalizeAddress(input.expectedPayer ?? intent.payerWalletAddress);
  const expectedAmount = ethers.parseUnits(intent.amountUsd.toString(), network.decimals ?? usdcDecimals());

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

  if (!matchingLog) {
    throw new Error('USDC_TRANSFER_NOT_FOUND');
  }

  return confirmPaymentIntent({
    paymentIntentId: intent.id,
    txHash: input.txHash,
    provider: 'usdc_onchain',
    payload: {
      txHash: input.txHash,
      chainId: intent.chainId,
      expectedAmount: expectedAmount.toString(),
      treasuryAddress: expectedTo,
      purchaseMode,
      vaultAddress: vaultAddress ?? null
    }
  });
}

async function verifyTronStablecoinPayment(input: {
  intent: Awaited<ReturnType<typeof prisma.paymentIntent.findUnique>> & NonNullable<unknown>;
  txHash: string;
  network: StablecoinNetwork;
  expectedPayer?: string | null;
}) {
  const expectedAmount = decimalToBaseUnits(input.intent.amountUsd.toString(), input.network.decimals);
  const response = await fetch(`${input.network.rpcUrl}/v1/transactions/${input.txHash}/events`);
  if (!response.ok) {
    throw new Error('TX_NOT_CONFIRMED');
  }
  const data = (await response.json()) as { data?: Array<{ event_name?: string; contract_address?: string; result?: Record<string, string> }> };
  const match = data.data?.some((event) => {
    const result = event.result ?? {};
    return (
      event.event_name === 'Transfer' &&
      event.contract_address?.toLowerCase() === input.network.tokenAddress?.toLowerCase() &&
      result.to === input.network.treasuryAddress &&
      result.value === expectedAmount &&
      (!input.expectedPayer || result.from === input.expectedPayer)
    );
  });

  if (!match) {
    throw new Error('STABLECOIN_TRANSFER_NOT_FOUND');
  }

  return confirmPaymentIntent({
    paymentIntentId: input.intent.id,
    txHash: input.txHash,
    provider: 'tron_stablecoin',
    payload: { network: input.network.id, expectedAmount }
  });
}

async function verifySolanaStablecoinPayment(input: {
  intent: Awaited<ReturnType<typeof prisma.paymentIntent.findUnique>> & NonNullable<unknown>;
  txHash: string;
  network: StablecoinNetwork;
}) {
  const response = await fetch(input.network.rpcUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: input.txHash,
      method: 'getTransaction',
      params: [input.txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
    })
  });
  const data = (await response.json()) as { result?: unknown };
  const haystack = JSON.stringify(data.result ?? {});
  const expectedAmount = input.intent.amountUsd.toString();

  if (!data.result || !haystack.includes(input.network.tokenAddress ?? '') || !haystack.includes(input.network.treasuryAddress ?? '') || !haystack.includes(expectedAmount)) {
    throw new Error('STABLECOIN_TRANSFER_NOT_FOUND');
  }

  return confirmPaymentIntent({
    paymentIntentId: input.intent.id,
    txHash: input.txHash,
    provider: 'solana_stablecoin',
    payload: { network: input.network.id, expectedAmount }
  });
}

function decimalToBaseUnits(value: string, decimals: number): string {
  const [whole, fraction = ''] = value.split('.');
  const padded = fraction.padEnd(decimals, '0').slice(0, decimals);
  return `${whole}${padded}`.replace(/^0+(?=\d)/, '') || '0';
}
