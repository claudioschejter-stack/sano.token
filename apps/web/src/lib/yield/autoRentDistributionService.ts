import { prisma } from '@sanova/database';
import { Contract, JsonRpcProvider, isAddress } from 'ethers';
import { creditAndDistributeOperatingRent } from './creditAndDistributeRent';

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

function resolveBaseRpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

/** USDC contract on Base mainnet */
function resolveUsdcAddress(): string {
  return (
    process.env.BASE_USDC_TOKEN_ADDRESS?.trim() ||
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  );
}

/** Treasury wallet that receives USDC from the Fiduciario / tenant payments */
function resolveTreasuryAddress(): string | null {
  const addr = process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim();
  if (!addr || !isAddress(addr)) return null;
  return addr;
}

/** Minimum new USDC (in USD) needed to trigger an automatic distribution round */
function resolveMinThreshold(): number {
  return Number(process.env.RENT_AUTO_DISTRIBUTE_MIN_USD ?? '500');
}

/**
 * Read USDC balance of the treasury wallet on Base.
 * Returns the amount in USD (USDC is 1:1 with USD).
 */
export async function getTreasuryUsdcBalanceUsd(): Promise<number | null> {
  const treasuryAddress = resolveTreasuryAddress();
  if (!treasuryAddress) return null;

  const provider = new JsonRpcProvider(resolveBaseRpcUrl());
  try {
    const usdc = new Contract(resolveUsdcAddress(), ERC20_ABI, provider);
    const decimals = Number(await usdc.decimals());
    const raw = BigInt(await usdc.balanceOf(treasuryAddress));
    return Number(raw) / 10 ** decimals;
  } finally {
    provider.destroy();
  }
}

/**
 * Sum of all project operating account balances denominated in USD.
 * A non-zero total means we've already credited income that hasn't been distributed yet.
 */
async function getTotalPendingOperatingBalanceUsd(): Promise<number> {
  const accounts = await prisma.projectOperatingAccount.findMany({
    where: { currency: 'USD' },
    select: { balance: true }
  });
  return accounts.reduce((sum, acc) => sum + acc.balance.toNumber(), 0);
}

/**
 * Get active projects with their total invested token counts.
 * Used to split treasury USDC proportionally across compartments.
 */
async function getActiveProjectsWithTokenCounts(): Promise<
  Array<{ id: string; title: string; tokenCount: number }>
> {
  const projects = await prisma.project.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      investments: {
        where: { status: 'ACTIVE' },
        select: { tokenCount: true }
      }
    }
  });

  return projects
    .map((p) => ({
      id: p.id,
      title: p.title,
      tokenCount: p.investments.reduce((sum, inv) => sum + inv.tokenCount, 0)
    }))
    .filter((p) => p.tokenCount > 0);
}

export type AutoDistributeResult =
  | { status: 'SKIPPED'; reason: string; detail?: unknown }
  | { status: 'DISTRIBUTED'; projectResults: ProjectDistributeResult[]; totalUsd: number }
  | { status: 'ERROR'; error: string };

type ProjectDistributeResult = {
  projectId: string;
  title: string;
  shareUsd: number;
  result: Awaited<ReturnType<typeof creditAndDistributeOperatingRent>> | null;
  error?: string;
};

/**
 * Core auto-distribution logic:
 *
 * 1. Reads USDC balance at the treasury wallet on Base.
 * 2. Skips if below the minimum threshold (default $500).
 * 3. Skips if there are already pending operating credits (prevents double-crediting).
 * 4. Splits the treasury balance pro-rata across all active projects by investor token count.
 * 5. Calls creditAndDistributeOperatingRent for each project share.
 *
 * Idempotent: the date-based idempotencyKey prevents re-running on the same day.
 */
export async function runAutoRentDistribution(): Promise<AutoDistributeResult> {
  const treasuryAddress = resolveTreasuryAddress();
  if (!treasuryAddress) {
    return {
      status: 'SKIPPED',
      reason: 'TREASURY_ADDRESS_NOT_CONFIGURED',
      detail: 'Set BASE_STABLECOIN_TREASURY_ADDRESS in environment variables'
    };
  }

  let usdcBalanceUsd: number;
  try {
    const balance = await getTreasuryUsdcBalanceUsd();
    if (balance === null) {
      return { status: 'SKIPPED', reason: 'TREASURY_ADDRESS_INVALID' };
    }
    usdcBalanceUsd = balance;
  } catch (err) {
    return {
      status: 'ERROR',
      error: `Failed to read treasury balance: ${err instanceof Error ? err.message : String(err)}`
    };
  }

  const minThreshold = resolveMinThreshold();
  if (usdcBalanceUsd < minThreshold) {
    return {
      status: 'SKIPPED',
      reason: 'BELOW_THRESHOLD',
      detail: { balanceUsd: usdcBalanceUsd, minThreshold }
    };
  }

  // Prevent double-crediting: if there are already unprocessed credits, don't add more
  const pendingBalanceUsd = await getTotalPendingOperatingBalanceUsd();
  if (pendingBalanceUsd >= minThreshold) {
    return {
      status: 'SKIPPED',
      reason: 'CREDITS_ALREADY_PENDING',
      detail: { pendingBalanceUsd, balanceUsd: usdcBalanceUsd }
    };
  }

  const projects = await getActiveProjectsWithTokenCounts();
  if (!projects.length) {
    return { status: 'SKIPPED', reason: 'NO_ACTIVE_PROJECTS' };
  }

  const totalTokens = projects.reduce((sum, p) => sum + p.tokenCount, 0);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const projectResults: ProjectDistributeResult[] = [];

  for (const project of projects) {
    const shareUsd =
      projects.length === 1
        ? usdcBalanceUsd
        : (project.tokenCount / totalTokens) * usdcBalanceUsd;

    const idempotencyKey = `auto-rent-dist:${today}:${project.id}`;

    try {
      const result = await creditAndDistributeOperatingRent({
        projectId: project.id,
        amount: shareUsd,
        currency: 'USD',
        idempotencyKey,
        autoConvertIfNeeded: false
      });
      projectResults.push({ projectId: project.id, title: project.title, shareUsd, result });
    } catch (err) {
      projectResults.push({
        projectId: project.id,
        title: project.title,
        shareUsd,
        result: null,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const totalUsd = projectResults.reduce((sum, r) => sum + r.shareUsd, 0);
  return { status: 'DISTRIBUTED', projectResults, totalUsd };
}
