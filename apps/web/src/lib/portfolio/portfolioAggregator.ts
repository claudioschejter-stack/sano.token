import { prisma, Prisma } from '@sanova/database';
import { failures, mapWithConcurrency, successes } from '../concurrency/mapWithConcurrency';
import { readMorphoOnChainDebtUsd } from './onChainMorphoDebtReader';
import { readVaultPositionsForProjects } from './onChainVaultReader';
import { readWalletUsdcBalances } from './onChainUsdcReader';

export type AggregatedPortfolio = {
  baseCurrency: 'USD';
  totals: {
    /** Suma bruta de activos (tokens + stablecoins + fiat) */
    totalValueUsd: number;
    grossAssetsUsd: number;
    /** Activos − préstamos */
    netLiquidValueUsd: number;
    rwaValueUsd: number;
    stablecoinUsd: number;
    fiatUsd: number;
    availableUsd: number;
    debtUsd: number;
    ltv: number;
  };
  positions: Array<{
    id: string;
    type: 'RWA_TOKEN' | 'STABLECOIN' | 'FIAT_BALANCE';
    label: string;
    amount: number;
    currency: string;
    valueUsdc: number;
    valueUsd: number;
    metadata?: Record<string, unknown>;
  }>;
  history: Array<{
    date: string;
    totalValueUsd: number;
    netLiquidValueUsd: number;
    rwaValueUsd: number;
    stablecoinUsd: number;
    fiatUsd: number;
    debtUsd: number;
  }>;
};

export async function aggregatePortfolioForUser(userId: string): Promise<AggregatedPortfolio> {
  const [user, walletAccounts, deposits, snapshots] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        investorId: true,
        investor: {
          select: {
            id: true,
            walletAddress: true,
            investments: {
              where: { status: 'ACTIVE' },
              include: {
                project: {
                  select: {
                    id: true,
                    title: true,
                    tokenSymbol: true,
                    pricePerToken: true,
                    vaultAddress: true,
                    chainId: true,
                    collateralTargets: true
                  }
                }
              },
              orderBy: { purchasedAt: 'desc' }
            }
          }
        }
      }
    }),
    prisma.platformWalletAccount.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { currency: 'asc' }
    }),
    prisma.platformDeposit.findMany({
      where: {
        userId,
        status: 'CONFIRMED',
        method: 'USDC_ONCHAIN'
      },
      orderBy: { confirmedAt: 'desc' },
      take: 20
    }),
    prisma.portfolioSnapshot.findMany({
      where: { userId },
      orderBy: { capturedAt: 'asc' },
      take: 90
    })
  ]);

  const investments = user?.investor?.investments ?? [];
  const onChainByProject =
    user?.investor?.walletAddress && investments.length > 0
      ? await readVaultPositionsForProjects({
          walletAddress: user.investor.walletAddress,
          projects: investments.map((investment) => ({
            projectId: investment.projectId,
            vaultAddress: investment.project.vaultAddress,
            chainId: investment.project.chainId
          }))
        })
      : new Map();

  /**
   * One position per asset, not per purchase.
   *
   * The chain reports a single balance per wallet and project, so a row per
   * purchase multiplied that same balance by the price once for each row: two
   * purchases of one token each showed up as two rows of $40, and the portfolio
   * total added them into $80 for $40 of holdings. The error grew with every
   * purchase. Buying more of something you already own is one bigger position.
   */
  const byProject = new Map<string, typeof investments>();
  for (const investment of investments) {
    const group = byProject.get(investment.projectId);
    if (group) {
      group.push(investment);
    } else {
      byProject.set(investment.projectId, [investment]);
    }
  }

  const rwaPositions = [...byProject.values()].map((group) => {
    // Ordered by purchasedAt desc, so the first is the latest.
    const latest = group[0];
    const project = latest.project;
    const onChain = onChainByProject.get(latest.projectId);

    const tokenCount = group.reduce((sum, row) => sum + row.tokenCount, 0);
    const bookedValueUsd = group.reduce((sum, row) => sum + row.purchasePriceUsd.toNumber(), 0);

    /**
     * The chain knows how many tokens are held; only the project knows what one
     * is worth. Multiplying here is what keeps the on-chain value in dollars.
     */
    const onChainValueUsd =
      onChain && onChain.assetTokens > 0
        ? onChain.assetTokens * project.pricePerToken.toNumber()
        : 0;
    const valueUsd = onChainValueUsd > 0 ? onChainValueUsd : bookedValueUsd;

    return {
      id: latest.id,
      type: 'RWA_TOKEN' as const,
      label: project.title,
      amount: tokenCount,
      currency: project.tokenSymbol ?? 'RWA',
      valueUsdc: valueUsd,
      valueUsd,
      metadata: {
        projectId: latest.projectId,
        pricePerTokenUsd: project.pricePerToken.toString(),
        purchasedAt: latest.purchasedAt.toISOString(),
        vaultAddress: project.vaultAddress,
        chainId: project.chainId,
        txHash: latest.txHash,
        onChainVerified: Boolean(onChain?.verified && onChain.assetTokens > 0),
        vaultShares: onChain?.shares ?? null,
        vaultShareDecimals: onChain?.shareDecimals ?? null,
        onChainAssetTokens: onChain?.assetTokens ?? null,
        onChainAssetsUsd: onChainValueUsd > 0 ? onChainValueUsd : null,
        bookedValueUsd,
        /** Each purchase stays visible, so grouping does not hide the history. */
        purchases: group.map((row) => ({
          investmentId: row.id,
          tokenCount: row.tokenCount,
          purchasePriceUsd: row.purchasePriceUsd.toNumber(),
          purchasedAt: row.purchasedAt.toISOString(),
          txHash: row.txHash
        }))
      }
    };
  });

  const rwaValueUsd = rwaPositions.reduce((sum, item) => sum + item.valueUsd, 0);
  const fiatPositions: AggregatedPortfolio['positions'] = walletAccounts.map((account) => {
      const available = account.balance.minus(account.reserved).toNumber();
      return {
        id: account.id,
        type: 'FIAT_BALANCE' as const,
        label: 'Saldo disponible',
        amount: available,
        currency: account.currency,
        valueUsdc: available,
        valueUsd: available,
        metadata: { reservedUsd: account.reserved.toString() }
    };
  });
  const availableUsd = fiatPositions.reduce((sum, item) => sum + item.valueUsd, 0);
  const fiatUsd = availableUsd;

  const stablecoinPositions: AggregatedPortfolio['positions'] = buildStablecoinPositions(deposits);
  const walletUsdcBalances =
    user?.investor?.walletAddress?.trim()
      ? await readWalletUsdcBalances(user.investor.walletAddress)
      : [];

  for (const balance of walletUsdcBalances) {
    // Prefer live on-chain wallet cash over historical deposit sums for the same network.
    const depositIdx = stablecoinPositions.findIndex(
      (row) =>
        row.type === 'STABLECOIN' &&
        String(row.metadata?.network ?? '') === balance.network &&
        row.metadata?.source === 'CONFIRMED_DEPOSITS'
    );
    if (depositIdx >= 0) {
      stablecoinPositions.splice(depositIdx, 1);
    }
    stablecoinPositions.push({
      id: `wallet-usdc-${balance.network}-${balance.chainId}`,
      type: 'STABLECOIN' as const,
      label: `${balance.symbol} en tu wallet (${balance.network})`,
      amount: balance.amountUsdc,
      currency: `${balance.symbol} · ${balance.network}`,
      valueUsdc: balance.amountUsdc,
      valueUsd: balance.amountUsdc,
      metadata: {
        source: 'ON_CHAIN_WALLET',
        walletAddress: balance.walletAddress,
        chainId: balance.chainId,
        network: balance.network
      }
    });
  }

  const stablecoinUsd = stablecoinPositions.reduce((sum, item) => sum + item.valueUsd, 0);
  const debtUsd = user?.investor
    ? await readMorphoOnChainDebtUsd({
        walletAddress: user.investor.walletAddress,
        projects: investments.map((investment) => ({
          vaultAddress: investment.project.vaultAddress,
          collateralTargets: investment.project.collateralTargets
        }))
      })
    : 0;
  const grossAssetsUsd = rwaValueUsd + stablecoinUsd + fiatUsd;
  const totalValueUsd = grossAssetsUsd;
  const netLiquidValueUsd = grossAssetsUsd - debtUsd;
  const ltv = grossAssetsUsd > 0 ? (debtUsd / grossAssetsUsd) * 100 : 0;

  const positions = [...rwaPositions, ...stablecoinPositions, ...fiatPositions].filter(
    (position) => position.valueUsd > 0
  );

  return {
    baseCurrency: 'USD',
    totals: {
      totalValueUsd,
      grossAssetsUsd,
      netLiquidValueUsd,
      rwaValueUsd,
      stablecoinUsd,
      fiatUsd,
      availableUsd,
      debtUsd,
      ltv
    },
    positions,
    history: snapshots.map((snapshot) => {
      const snapshotGross = snapshot.totalValueUsd.toNumber();
      const snapshotDebt = snapshot.debtUsd.toNumber();
      return {
        date: snapshot.capturedAt.toISOString(),
        totalValueUsd: snapshotGross,
        netLiquidValueUsd: snapshotGross - snapshotDebt,
        rwaValueUsd: snapshot.rwaValueUsd.toNumber(),
        stablecoinUsd: snapshot.stablecoinUsd.toNumber(),
        fiatUsd: snapshot.fiatUsd.toNumber(),
        debtUsd: snapshotDebt
      };
    })
  };
}

export async function recordPortfolioSnapshot(
  userId: string,
  capturedAt = startOfUtcDay(new Date()),
  precomputed?: AggregatedPortfolio
) {
  const portfolio = precomputed ?? (await aggregatePortfolioForUser(userId));
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { investorId: true }
  });

  return prisma.portfolioSnapshot.upsert({
    where: {
      userId_capturedAt: {
        userId,
        capturedAt
      }
    },
    create: {
      userId,
      investorId: user?.investorId,
      baseCurrency: 'USD',
      totalValueUsd: portfolio.totals.totalValueUsd,
      rwaValueUsd: portfolio.totals.rwaValueUsd,
      stablecoinUsd: portfolio.totals.stablecoinUsd,
      fiatUsd: portfolio.totals.fiatUsd,
      availableUsd: portfolio.totals.availableUsd,
      debtUsd: portfolio.totals.debtUsd,
      ltv: portfolio.totals.ltv,
      positions: portfolio.positions as Prisma.InputJsonValue,
      capturedAt
    },
    update: {
      investorId: user?.investorId,
      totalValueUsd: portfolio.totals.totalValueUsd,
      rwaValueUsd: portfolio.totals.rwaValueUsd,
      stablecoinUsd: portfolio.totals.stablecoinUsd,
      fiatUsd: portfolio.totals.fiatUsd,
      availableUsd: portfolio.totals.availableUsd,
      debtUsd: portfolio.totals.debtUsd,
      ltv: portfolio.totals.ltv,
      positions: portfolio.positions as Prisma.InputJsonValue
    }
  });
}

/**
 * How many investors to aggregate at once.
 *
 * Each snapshot reads the chain — USDC balance and Morpho debt — so doing them
 * one after another made the run grow linearly with the investor base, inside a
 * function that Vercel stops at 300 seconds. On the public RPC that serial
 * pacing was self-defence: bursts came back as `missing revert data`. With a
 * dedicated endpoint the reads can overlap, and a bounded window keeps the
 * burst small enough not to trade one failure mode for another.
 */
const SNAPSHOT_CONCURRENCY = 8;

export async function recordPortfolioSnapshotsForActiveInvestors(limit = 100) {
  const users = await prisma.user.findMany({
    where: {
      investorId: { not: null }
    },
    select: { id: true },
    take: limit
  });

  const results = await mapWithConcurrency(users, SNAPSHOT_CONCURRENCY, (user) =>
    recordPortfolioSnapshot(user.id)
  );

  for (const { item, error } of failures(results)) {
    // One investor's snapshot must not cost everyone else's, which is what the
    // serial loop did: it threw and abandoned the rest of the list.
    console.error('[recordPortfolioSnapshotsForActiveInvestors] failed', item.id, error);
  }

  return successes(results);
}

function buildStablecoinPositions(deposits: Array<{
  id: string;
  amountUsd: Prisma.Decimal;
  stablecoinNetwork: string | null;
  stablecoinSymbol: string | null;
  txHash: string | null;
}>): AggregatedPortfolio['positions'] {
  const grouped = new Map<string, { amount: number; symbol: string; network: string; txHashes: string[] }>();
  for (const deposit of deposits) {
    const network = deposit.stablecoinNetwork ?? 'UNKNOWN';
    const symbol = deposit.stablecoinSymbol ?? 'USDC';
    const key = `${network}:${symbol}`;
    const current = grouped.get(key) ?? { amount: 0, symbol, network, txHashes: [] };
    current.amount += deposit.amountUsd.toNumber();
    if (deposit.txHash) current.txHashes.push(deposit.txHash);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((item) => ({
    id: `stablecoin-${item.network}-${item.symbol}`,
    type: 'STABLECOIN' as const,
    label: `${item.symbol} acreditado (${item.network})`,
    amount: item.amount,
    currency: `${item.symbol} · ${item.network}`,
    valueUsdc: item.amount,
    valueUsd: item.amount,
    metadata: {
      network: item.network,
      source: 'CONFIRMED_DEPOSITS',
      recentTxHashes: item.txHashes.slice(0, 5)
    }
  }));
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
