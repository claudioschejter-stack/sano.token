import { Contract, JsonRpcProvider, formatUnits, getAddress, isAddress } from 'ethers';
import { prisma } from '@sanova/database';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { readWithRetry } from '../blockchain/rpcRetry';
import { vaultShareDeliveryUiState } from './vaultShareDeliveryStatus';

const VAULT_ABI = ['function balanceOf(address) view returns (uint256)'];
const SHARE_DECIMALS = 18;

export type ShareDeliveryIntent = {
  paymentIntentId: string;
  projectId: string;
  projectTitle: string;
  email: string | null;
  tokenCount: number;
  recipient: string | null;
  vaultAddress: string | null;
  /** Raw metadata status, or NOT_STARTED when delivery never ran. */
  deliveryStatus: string;
  deliveryDetail: string | null;
  deliveryTxHash: string | null;
  confirmedAt: string | null;
};

export type ShareHolding = {
  projectId: string;
  projectTitle: string;
  vaultAddress: string;
  recipient: string;
  email: string | null;
  /** Tokens the investor paid for, across every confirmed purchase. */
  expectedTokens: number;
  /** Null when the RPC would not answer: absence of a read is not a shortfall. */
  onchainShares: string | null;
  shortfallTokens: number | null;
};

export type ShareDeliveryAudit = {
  generatedAt: string;
  /** False when a paid purchase has no shares in the investor's wallet. */
  complete: boolean;
  confirmedPurchases: number;
  /** Paid but the shares never left the treasury. */
  pending: ShareDeliveryIntent[];
  holdings: ShareHolding[];
};

function rpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

function normalise(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw && isAddress(raw) ? getAddress(raw) : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Where the shares of a paid purchase were meant to land. Mirrors the order the
 * delivery itself resolves, so the audit blames the same wallet the transfer
 * would have used.
 */
async function resolveRecipient(intent: {
  userId: string;
  payerWalletAddress: string | null;
  metadata: unknown;
}): Promise<string | null> {
  const metadata = (intent.metadata as Record<string, unknown>) ?? {};
  const linked = await getLinkedWalletForUser(intent.userId).catch(() => null);
  return (
    normalise(linked) ??
    normalise(metadata.shareReceiverWallet) ??
    normalise(intent.payerWalletAddress)
  );
}

/**
 * Whether the investor already holds every share their confirmed purchases of
 * this project owe them.
 *
 * A delivery killed mid-flight — the checkout function running out of time
 * after the transfer was broadcast — leaves no record of the hash, and the
 * retry would happily send a second one. Asking the vault what arrived is what
 * makes the retry safe to run as often as we like.
 */
export async function sharesAlreadyDelivered(input: {
  vaultAddress: string;
  recipient: string;
  userId: string;
  projectId: string;
}): Promise<{ covered: boolean; owedTokens: number; onchainShares: string | null }> {
  const vault = normalise(input.vaultAddress);
  const recipient = normalise(input.recipient);
  if (!vault || !recipient) {
    return { covered: false, owedTokens: 0, onchainShares: null };
  }

  const confirmed = await prisma.paymentIntent.findMany({
    where: { userId: input.userId, projectId: input.projectId, status: 'CONFIRMED' },
    select: { tokenCount: true, metadata: true }
  });

  const owedTokens = confirmed
    .filter(
      (row) => (row.metadata as Record<string, unknown>)?.purchaseMode === 'ERC4626_DEPOSIT'
    )
    .reduce((sum, row) => sum + row.tokenCount, 0);

  if (owedTokens <= 0) {
    return { covered: false, owedTokens: 0, onchainShares: null };
  }

  const provider = new JsonRpcProvider(rpcUrl());
  try {
    const contract = new Contract(vault, VAULT_ABI, provider);
    const balance = await readWithRetry(() => contract.balanceOf(recipient) as Promise<bigint>);
    if (balance === null) {
      return { covered: false, owedTokens, onchainShares: null };
    }
    const onchainShares = formatUnits(balance, SHARE_DECIMALS);
    return {
      covered: Number(onchainShares) >= owedTokens,
      owedTokens,
      onchainShares
    };
  } finally {
    provider.destroy();
  }
}

/**
 * Confirmed vault purchases checked against the chain: whether delivery ran at
 * all, and whether the investor actually holds the shares.
 *
 * The supply audit compares the database with itself, so a purchase whose USDC
 * arrived and whose shares never moved looks perfectly aligned there. This is
 * the only place that asks the vault.
 */
export async function auditShareDelivery(input?: {
  projectId?: string;
  userId?: string;
  limit?: number;
}): Promise<ShareDeliveryAudit> {
  const intents = await prisma.paymentIntent.findMany({
    where: {
      status: 'CONFIRMED',
      ...(input?.projectId ? { projectId: input.projectId } : {}),
      ...(input?.userId ? { userId: input.userId } : {})
    },
    orderBy: { confirmedAt: 'desc' },
    take: input?.limit ?? 200,
    select: {
      id: true,
      userId: true,
      projectId: true,
      tokenCount: true,
      payerWalletAddress: true,
      metadata: true,
      confirmedAt: true
    }
  });

  const vaultPurchases = intents.filter(
    (intent) => (intent.metadata as Record<string, unknown>)?.purchaseMode === 'ERC4626_DEPOSIT'
  );

  if (vaultPurchases.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      complete: true,
      confirmedPurchases: 0,
      pending: [],
      holdings: []
    };
  }

  const projectIds = [...new Set(vaultPurchases.map((intent) => intent.projectId))];
  const userIds = [...new Set(vaultPurchases.map((intent) => intent.userId))];

  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, title: true, vaultAddress: true }
    }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
  ]);

  const projectById = new Map(projects.map((row) => [row.id, row]));
  const emailById = new Map(users.map((row) => [row.id, row.email]));

  const rows: ShareDeliveryIntent[] = [];
  const pending: ShareDeliveryIntent[] = [];
  const expected = new Map<
    string,
    { projectId: string; recipient: string; vaultAddress: string; email: string | null; tokens: number }
  >();

  for (const intent of vaultPurchases) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    const project = projectById.get(intent.projectId);
    const recipient = await resolveRecipient(intent);
    const vaultAddress = normalise(project?.vaultAddress);

    const row: ShareDeliveryIntent = {
      paymentIntentId: intent.id,
      projectId: intent.projectId,
      projectTitle: project?.title ?? intent.projectId,
      email: emailById.get(intent.userId) ?? null,
      tokenCount: intent.tokenCount,
      recipient,
      vaultAddress,
      deliveryStatus: stringOrNull(metadata.vaultShareDeliveryStatus) ?? 'NOT_STARTED',
      deliveryDetail: stringOrNull(metadata.vaultShareDeliveryDetail),
      deliveryTxHash: stringOrNull(metadata.vaultShareDeliveryTxHash),
      confirmedAt: intent.confirmedAt?.toISOString() ?? null
    };
    rows.push(row);

    if (vaultShareDeliveryUiState(metadata) !== 'delivered') {
      pending.push(row);
    }

    if (recipient && vaultAddress) {
      const key = `${vaultAddress}:${recipient}`;
      const current = expected.get(key);
      if (current) {
        current.tokens += intent.tokenCount;
      } else {
        expected.set(key, {
          projectId: intent.projectId,
          recipient,
          vaultAddress,
          email: row.email,
          tokens: intent.tokenCount
        });
      }
    }
  }

  const provider = new JsonRpcProvider(rpcUrl());
  const holdings: ShareHolding[] = [];

  try {
    for (const entry of expected.values()) {
      const vault = new Contract(entry.vaultAddress, VAULT_ABI, provider);
      const balance = await readWithRetry(() => vault.balanceOf(entry.recipient) as Promise<bigint>);
      const onchainTokens =
        balance === null ? null : Number(formatUnits(balance, SHARE_DECIMALS));

      holdings.push({
        projectId: entry.projectId,
        projectTitle: projectById.get(entry.projectId)?.title ?? entry.projectId,
        vaultAddress: entry.vaultAddress,
        recipient: entry.recipient,
        email: entry.email,
        expectedTokens: entry.tokens,
        onchainShares: balance === null ? null : formatUnits(balance, SHARE_DECIMALS),
        shortfallTokens:
          onchainTokens === null ? null : Math.max(0, entry.tokens - onchainTokens)
      });
    }
  } finally {
    provider.destroy();
  }

  const shortfall = holdings.some((row) => (row.shortfallTokens ?? 0) > 0);

  return {
    generatedAt: new Date().toISOString(),
    complete: pending.length === 0 && !shortfall,
    confirmedPurchases: rows.length,
    pending,
    holdings
  };
}
