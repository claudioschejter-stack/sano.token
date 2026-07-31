import { prisma, Prisma } from '@sanova/database';
import { ethers } from 'ethers';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { readWalletUsdcBalances } from '../portfolio/onChainUsdcReader';
import { paymentMinimumConfirmations, paymentOrderTtlMinutes } from './paymentConfig';
import { getStablecoinNetwork } from './stablecoinNetworks';
import { serializeDeposit } from './platformWalletService';

const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from,address indexed to,uint256 value)'];

/** ~50 min lookback on Base (~2s blocks). */
const PRIVY_INBOUND_LOOKBACK_BLOCKS = 1500;

export type PendingPrivyPurchase = {
  batchId: string;
  amountUsd: number;
  intentIds: string[];
};

export type PrivyInboundRecord = {
  txHash: string;
  amountUsd: number;
  from: string;
  to: string;
  depositId: string;
};

export type PrivyInboundScanResult = {
  address: string | null;
  balanceUsdc: number;
  newInbounds: PrivyInboundRecord[];
  recentInbounds: PrivyInboundRecord[];
  pendingPurchase: PendingPrivyPurchase | null;
  readyToAutoSettle: boolean;
};

function providerTag() {
  return 'privy_inbound_watch';
}

async function txHashAlreadyRecorded(txHash: string): Promise<boolean> {
  const existing = await prisma.platformDeposit.findFirst({
    where: { txHash },
    select: { id: true }
  });
  if (existing) return true;

  const intent = await prisma.paymentIntent.findFirst({
    where: { txHash },
    select: { id: true }
  });
  return Boolean(intent);
}

/**
 * Finds the newest open USDC cart batch for the investor (if any).
 * Identity comes from the logged-in user + linked Privy address — not shared treasury matching.
 */
export async function findPendingUsdcCartPurchase(userId: string): Promise<PendingPrivyPurchase | null> {
  const intents = await prisma.paymentIntent.findMany({
    where: {
      userId,
      status: { in: ['REQUIRES_PAYMENT', 'PENDING'] },
      method: 'USDC_ONCHAIN',
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      id: true,
      amountUsd: true,
      metadata: true,
      createdAt: true
    }
  });

  const toAmount = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value === 'object' && 'toString' in value) {
      const parsed = Number(String((value as { toString: () => string }).toString()));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const batches = new Map<string, { amountUsd: number; intentIds: string[]; createdAt: Date }>();

  for (const intent of intents) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    const batchId =
      typeof metadata.cartBatchId === 'string' && metadata.cartBatchId.trim()
        ? metadata.cartBatchId.trim()
        : null;
    if (!batchId) continue;

    const current = batches.get(batchId) ?? {
      amountUsd: 0,
      intentIds: [],
      createdAt: intent.createdAt
    };
    current.amountUsd += toAmount(intent.amountUsd);
    current.intentIds.push(intent.id);
    if (intent.createdAt > current.createdAt) {
      current.createdAt = intent.createdAt;
    }
    batches.set(batchId, current);
  }

  const newest = [...batches.entries()].sort((a, b) => b[1].createdAt.getTime() - a[1].createdAt.getTime())[0];
  if (!newest) return null;

  return {
    batchId: newest[0],
    amountUsd: Number(newest[1].amountUsd.toFixed(6)),
    intentIds: newest[1].intentIds
  };
}

async function markPendingCartInboundReady(input: {
  userId: string;
  batchId: string;
  txHash?: string | null;
  balanceUsdc: number;
}) {
  const intents = await prisma.paymentIntent.findMany({
    where: {
      userId: input.userId,
      status: { in: ['REQUIRES_PAYMENT', 'PENDING'] }
    },
    select: { id: true, metadata: true }
  });

  for (const intent of intents) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    if (metadata.cartBatchId !== input.batchId) continue;

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        metadata: {
          ...metadata,
          privyInboundReady: true,
          privyInboundReadyAt: new Date().toISOString(),
          privyInboundTxHash: input.txHash ?? metadata.privyInboundTxHash ?? null,
          privyWalletBalanceUsdc: input.balanceUsdc
        } as Prisma.InputJsonObject
      }
    });
  }
}

/**
 * Records a Transfer *to* the investor Privy wallet as a confirmed deposit history row.
 * Does NOT credit PlatformWalletAccount (funds remain in the user-controlled Privy wallet —
 * spending happens via Privy → treasury, then share delivery).
 */
async function recordPrivyInboundDeposit(input: {
  userId: string;
  amountUsd: number;
  from: string;
  to: string;
  txHash: string;
  blockNumber: number;
}) {
  if (await txHashAlreadyRecorded(input.txHash)) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { investorId: true }
  });

  const expiresAt = new Date(Date.now() + paymentOrderTtlMinutes() * 60_000);
  const deposit = await prisma.platformDeposit.create({
    data: {
      userId: input.userId,
      investorId: user?.investorId ?? null,
      status: 'CONFIRMED',
      amountUsd: new Prisma.Decimal(input.amountUsd.toFixed(6)),
      method: 'USDC_ONCHAIN',
      stablecoinNetwork: 'BASE',
      stablecoinSymbol: 'USDC',
      payerWalletAddress: input.from,
      payToAddress: input.to,
      txHash: input.txHash,
      provider: providerTag(),
      providerPaymentId: input.txHash,
      idempotencyKey: `privy-inbound:${input.txHash}`,
      expiresAt,
      confirmedAt: new Date(),
      metadata: {
        custody: 'privy_wallet',
        skipLedgerCredit: true,
        autoDetected: true,
        blockNumber: input.blockNumber,
        note: 'USDC received in investor Privy wallet (available balance is on-chain)'
      } as Prisma.InputJsonObject
    }
  });

  return serializeDeposit(deposit);
}

async function listRecentPrivyInbounds(userId: string): Promise<PrivyInboundRecord[]> {
  const rows = await prisma.platformDeposit.findMany({
    where: {
      userId,
      provider: providerTag(),
      status: 'CONFIRMED',
      txHash: { not: null }
    },
    orderBy: { confirmedAt: 'desc' },
    take: 10
  });

  return rows
    .filter((row) => row.txHash && row.payToAddress && row.payerWalletAddress)
    .map((row) => ({
      txHash: row.txHash as string,
      amountUsd: Number(row.amountUsd),
      from: row.payerWalletAddress as string,
      to: row.payToAddress as string,
      depositId: row.id
    }));
}

/**
 * Scans Base USDC Transfer logs where `to` is the investor's linked Privy wallet.
 * Attribution is unambiguous: each investor has their own receive address.
 */
export async function scanPrivyInboundForUser(userId: string): Promise<PrivyInboundScanResult> {
  const address = await getLinkedWalletForUser(userId);
  const pendingPurchase = await findPendingUsdcCartPurchase(userId);

  if (!address) {
    return {
      address: null,
      balanceUsdc: 0,
      newInbounds: [],
      recentInbounds: await listRecentPrivyInbounds(userId),
      pendingPurchase,
      readyToAutoSettle: false
    };
  }

  const balances = await readWalletUsdcBalances(address, ['BASE']);
  const balanceUsdc = balances.reduce((sum, row) => sum + row.amountUsdc, 0);

  const network = getStablecoinNetwork('BASE');
  const newInbounds: PrivyInboundRecord[] = [];

  if (network.rpcUrl && network.tokenAddress && network.kind === 'EVM') {
    try {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
      const expectedTo = ethers.getAddress(address);
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - PRIVY_INBOUND_LOOKBACK_BLOCKS);

      const logs = await provider.getLogs({
        address: network.tokenAddress,
        topics: [USDC_TRANSFER_TOPIC, null, ethers.zeroPadValue(expectedTo, 32)],
        fromBlock,
        toBlock: latestBlock
      });

      // Newest first so concurrent deposits credit in arrival order.
      const ordered = [...logs].reverse();

      for (const log of ordered) {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) continue;

        const from = ethers.getAddress(parsed.args.from as string);
        const to = ethers.getAddress(parsed.args.to as string);
        const value = parsed.args.value as bigint;
        if (value <= 0n) continue;

        const receipt = await provider.getTransactionReceipt(log.transactionHash);
        const confirmations = receipt ? latestBlock - receipt.blockNumber + 1 : 0;
        if (!receipt || receipt.status !== 1 || confirmations < paymentMinimumConfirmations()) {
          continue;
        }

        if (await txHashAlreadyRecorded(log.transactionHash)) {
          continue;
        }

        const amountUsd = Number(ethers.formatUnits(value, network.decimals));
        const recorded = await recordPrivyInboundDeposit({
          userId,
          amountUsd,
          from,
          to,
          txHash: log.transactionHash,
          blockNumber: receipt.blockNumber
        });

        if (recorded) {
          newInbounds.push({
            txHash: log.transactionHash,
            amountUsd,
            from,
            to,
            depositId: recorded.id
          });
        }
      }

      provider.destroy();
    } catch (error) {
      console.error('[scanPrivyInboundForUser]', userId, error);
    }
  }

  const readyToAutoSettle = Boolean(
    pendingPurchase && balanceUsdc + 1e-9 >= pendingPurchase.amountUsd
  );

  if (readyToAutoSettle && pendingPurchase) {
    await markPendingCartInboundReady({
      userId,
      batchId: pendingPurchase.batchId,
      txHash: newInbounds[0]?.txHash ?? null,
      balanceUsdc
    });
  }

  return {
    address,
    balanceUsdc,
    newInbounds,
    recentInbounds: await listRecentPrivyInbounds(userId),
    pendingPurchase,
    readyToAutoSettle
  };
}

/** Cron safety net: scan linked wallets with recent open carts or any linked investor wallet. */
export async function scanAllPrivyInboundWallets() {
  const openIntents = await prisma.paymentIntent.findMany({
    where: {
      status: { in: ['REQUIRES_PAYMENT', 'PENDING'] },
      method: 'USDC_ONCHAIN',
      expiresAt: { gt: new Date() }
    },
    select: { userId: true },
    distinct: ['userId'],
    take: 100
  });

  const linkedUsers = await prisma.user.findMany({
    where: {
      OR: [{ walletAddress: { not: null } }, { investor: { walletAddress: { not: null } } }]
    },
    select: { id: true },
    take: 200,
    orderBy: { updatedAt: 'desc' }
  });

  const userIds = [...new Set([...openIntents.map((row) => row.userId), ...linkedUsers.map((row) => row.id)])];

  let newInboundCount = 0;
  let readyCount = 0;

  for (const userId of userIds) {
    try {
      const result = await scanPrivyInboundForUser(userId);
      newInboundCount += result.newInbounds.length;
      if (result.readyToAutoSettle) readyCount += 1;
    } catch (error) {
      console.error('[scanAllPrivyInboundWallets]', userId, error);
    }
  }

  return {
    scanned: userIds.length,
    newInbounds: newInboundCount,
    readyToAutoSettle: readyCount
  };
}
