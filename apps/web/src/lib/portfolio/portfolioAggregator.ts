import { prisma, Prisma } from '@sanova/database';
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
  const [user, wallet, deposits, snapshots] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        investorId: true,
        investor: {
          select: {
            id: true,
            marginDebt: true,
            ltv: true,
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
                    chainId: true
                  }
                }
              },
              orderBy: { purchasedAt: 'desc' }
            }
          }
        }
      }
    }),
    prisma.platformWalletAccount.findUnique({
      where: { userId_currency: { userId, currency: 'USD' } }
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

  const rwaPositions = investments.map((investment) => {
    const onChain = onChainByProject.get(investment.projectId);
    const bookedValueUsd = investment.purchasePriceUsd.toNumber();
    const valueUsd = onChain && onChain.assetsUsd > 0 ? onChain.assetsUsd : bookedValueUsd;

    return {
      id: investment.id,
      type: 'RWA_TOKEN' as const,
      label: investment.project.title,
      amount: investment.tokenCount,
      currency: investment.project.tokenSymbol ?? 'RWA',
      valueUsdc: valueUsd,
      valueUsd,
      metadata: {
        projectId: investment.projectId,
        pricePerTokenUsd: investment.project.pricePerToken.toString(),
        purchasedAt: investment.purchasedAt.toISOString(),
        vaultAddress: investment.project.vaultAddress,
        chainId: investment.project.chainId,
        txHash: investment.txHash,
        onChainVerified: Boolean(onChain?.verified && onChain.assetsUsd > 0),
        vaultShares: onChain?.shares ?? null,
        onChainAssetsUsd: onChain?.assetsUsd ?? null,
        bookedValueUsd
      }
    };
  });

  const rwaValueUsd = rwaPositions.reduce((sum, item) => sum + item.valueUsd, 0);
  const availableUsd = wallet ? wallet.balance.minus(wallet.reserved).toNumber() : 0;
  const fiatUsd = availableUsd;

  const stablecoinPositions: AggregatedPortfolio['positions'] = buildStablecoinPositions(deposits);
  const walletUsdcBalances =
    user?.investor?.walletAddress?.trim()
      ? await readWalletUsdcBalances(user.investor.walletAddress)
      : [];

  for (const balance of walletUsdcBalances) {
    stablecoinPositions.push({
      id: `wallet-usdc-${balance.network}-${balance.chainId}`,
      type: 'STABLECOIN' as const,
      label: `${balance.symbol} en wallet (${balance.network})`,
      amount: balance.amountUsdc,
      currency: balance.symbol,
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
  const debtUsd = user?.investor?.marginDebt.toNumber() ?? 0;
  const grossAssetsUsd = rwaValueUsd + stablecoinUsd + fiatUsd;
  const totalValueUsd = grossAssetsUsd;
  const netLiquidValueUsd = grossAssetsUsd - debtUsd;
  const ltv = grossAssetsUsd > 0 ? (debtUsd / grossAssetsUsd) * 100 : 0;

  const positions = [
    ...rwaPositions,
    ...stablecoinPositions,
    {
      id: wallet?.id ?? `wallet-${userId}`,
      type: 'FIAT_BALANCE' as const,
      label: 'Saldo Sanova disponible',
      amount: availableUsd,
      currency: 'USD',
      valueUsdc: availableUsd,
      valueUsd: availableUsd,
      metadata: { reservedUsd: wallet?.reserved.toString() ?? '0' }
    }
  ].filter((position) => position.valueUsd > 0 || position.type === 'FIAT_BALANCE');

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

export async function recordPortfolioSnapshot(userId: string, capturedAt = startOfUtcDay(new Date())) {
  const portfolio = await aggregatePortfolioForUser(userId);
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

export async function recordPortfolioSnapshotsForActiveInvestors(limit = 100) {
  const users = await prisma.user.findMany({
    where: {
      investorId: { not: null }
    },
    select: { id: true },
    take: limit
  });

  const snapshots = [];
  for (const user of users) {
    snapshots.push(await recordPortfolioSnapshot(user.id));
  }
  return snapshots;
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
    label: `${item.symbol} en ${item.network}`,
    amount: item.amount,
    currency: item.symbol,
    valueUsdc: item.amount,
    valueUsd: item.amount,
    metadata: { network: item.network, recentTxHashes: item.txHashes.slice(0, 5) }
  }));
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
