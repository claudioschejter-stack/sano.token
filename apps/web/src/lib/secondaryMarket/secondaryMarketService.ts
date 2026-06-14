import { prisma, Prisma } from '@sanova/database';
import { listMarketplaceListings } from '../admin/assetsService';
import { assertInvestorCheckoutEligible, ensureInvestorForUser, getUserPurchaseContext } from '../investor/investorService';
import { creditPlatformWallet, debitPlatformWalletForPurchase } from '../payments/platformWalletService';
import type {
  SecondaryMarketFeed,
  SecondaryMarketHolding,
  SecondaryMarketOrder,
  SecondaryMarketProperty
} from '../../types/secondaryMarket';

const PLATFORM_BUYBACK_DISCOUNT = 0.03;

async function getActiveTokenHoldings(userId: string): Promise<Map<string, number>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      investorId: true,
      investor: {
        select: {
          investments: {
            where: { status: 'ACTIVE' },
            select: { projectId: true, tokenCount: true }
          }
        }
      }
    }
  });

  const holdings = new Map<string, number>();

  for (const investment of user?.investor?.investments ?? []) {
    holdings.set(investment.projectId, (holdings.get(investment.projectId) ?? 0) + investment.tokenCount);
  }

  return holdings;
}

async function getOpenListedTokens(userId: string): Promise<Map<string, number>> {
  const rows = await prisma.secondaryMarketListing.groupBy({
    by: ['projectId'],
    where: { sellerUserId: userId, status: 'OPEN' },
    _sum: { tokenCount: true }
  });

  const listed = new Map<string, number>();
  for (const row of rows) {
    listed.set(row.projectId, row._sum.tokenCount ?? 0);
  }

  return listed;
}

export async function getSecondaryMarketHoldings(userId: string): Promise<SecondaryMarketHolding[]> {
  const [owned, listed] = await Promise.all([
    getActiveTokenHoldings(userId),
    getOpenListedTokens(userId)
  ]);

  const projectIds = new Set([...owned.keys(), ...listed.keys()]);

  return Array.from(projectIds).map((projectId) => {
    const ownedTokens = owned.get(projectId) ?? 0;
    const listedTokens = listed.get(projectId) ?? 0;

    return {
      projectId,
      ownedTokens,
      listedTokens,
      availableToSell: Math.max(0, ownedTokens - listedTokens)
    };
  });
}

export async function getSecondaryMarketFeed(viewerUserId?: string): Promise<SecondaryMarketFeed> {
  const listings = await listMarketplaceListings({ skipHeavySync: true });

  type OpenOrderRow = Awaited<
    ReturnType<
      typeof prisma.secondaryMarketListing.findMany<{
        include: {
          sellerUser: { select: { id: true; name: true; kycFullName: true; email: true } };
        };
      }>
    >
  >;

  let openOrders: OpenOrderRow = [];

  try {
    openOrders = await prisma.secondaryMarketListing.findMany({
      where: { status: 'OPEN' },
      include: {
        sellerUser: { select: { id: true, name: true, kycFullName: true, email: true } }
      },
      orderBy: [{ pricePerTokenUsd: 'asc' }, { createdAt: 'asc' }]
    });
  } catch (error) {
    console.error('[secondaryMarket] listings table unavailable', error);
  }

  const ordersByProject = new Map<string, SecondaryMarketOrder[]>();

  for (const order of openOrders) {
    const pricePerTokenUsd = order.pricePerTokenUsd.toNumber();
    const mapped: SecondaryMarketOrder = {
      id: order.id,
      projectId: order.projectId,
      sellerUserId: order.sellerUserId,
      sellerName: order.sellerUser.kycFullName ?? order.sellerUser.name ?? 'Inversor',
      tokenCount: order.tokenCount,
      pricePerTokenUsd,
      totalUsd: pricePerTokenUsd * order.tokenCount,
      createdAt: order.createdAt.toISOString(),
      isOwnListing: viewerUserId ? order.sellerUserId === viewerUserId : false
    };

    const bucket = ordersByProject.get(order.projectId) ?? [];
    bucket.push(mapped);
    ordersByProject.set(order.projectId, bucket);
  }

  const properties: SecondaryMarketProperty[] = listings.map((listing) => {
    const orders = [...(ordersByProject.get(listing.id) ?? [])].sort(
      (a, b) => a.pricePerTokenUsd - b.pricePerTokenUsd
    );
    const referencePriceUsd = listing.pricePerTokenUsd;
    const buybackPriceUsd = Number((referencePriceUsd * (1 - PLATFORM_BUYBACK_DISCOUNT)).toFixed(2));
    const totalTokensForSale = orders.reduce((sum, row) => sum + row.tokenCount, 0);
    const lowestAskUsd = orders.length > 0 ? orders[0].pricePerTokenUsd : null;

    return {
      listing,
      orders,
      platformBuyback: {
        id: `buyback-${listing.id}`,
        projectId: listing.id,
        pricePerTokenUsd: buybackPriceUsd,
        referencePriceUsd,
        discountPercent: Math.round(PLATFORM_BUYBACK_DISCOUNT * 100),
        label: 'Sanova'
      },
      totalTokensForSale,
      lowestAskUsd
    };
  });

  return {
    properties,
    cachedAt: new Date().toISOString()
  };
}

export async function createSecondaryListing(input: {
  userId: string;
  projectId: string;
  tokenCount: number;
  pricePerTokenUsd: number;
}) {
  if (!Number.isInteger(input.tokenCount) || input.tokenCount <= 0) {
    throw new Error('INVALID_TOKEN_COUNT');
  }

  if (!Number.isFinite(input.pricePerTokenUsd) || input.pricePerTokenUsd <= 0) {
    throw new Error('INVALID_PRICE');
  }

  const sellerContext = await getUserPurchaseContext(input.userId);
  if (!sellerContext) {
    throw new Error('USER_NOT_FOUND');
  }

  assertInvestorCheckoutEligible(sellerContext);

  const holdings = await getSecondaryMarketHoldings(input.userId);
  const holding = holdings.find((row) => row.projectId === input.projectId);

  if (!holding || holding.availableToSell < input.tokenCount) {
    throw new Error('INSUFFICIENT_TOKENS');
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, isActive: true }
  });

  if (!project?.isActive) {
    throw new Error('PROJECT_NOT_AVAILABLE');
  }

  const listing = await prisma.secondaryMarketListing.create({
    data: {
      sellerUserId: input.userId,
      projectId: input.projectId,
      tokenCount: input.tokenCount,
      pricePerTokenUsd: input.pricePerTokenUsd
    }
  });

  return {
    id: listing.id,
    projectId: listing.projectId,
    tokenCount: listing.tokenCount,
    pricePerTokenUsd: listing.pricePerTokenUsd.toNumber(),
    createdAt: listing.createdAt.toISOString()
  };
}

export async function cancelSecondaryListing(input: { userId: string; listingId: string }) {
  const listing = await prisma.secondaryMarketListing.findUnique({
    where: { id: input.listingId }
  });

  if (!listing || listing.status !== 'OPEN') {
    throw new Error('LISTING_NOT_FOUND');
  }

  if (listing.sellerUserId !== input.userId) {
    throw new Error('FORBIDDEN');
  }

  await prisma.secondaryMarketListing.update({
    where: { id: listing.id },
    data: { status: 'CANCELLED' }
  });

  return { ok: true as const };
}

export async function buySecondaryListing(input: { buyerUserId: string; listingId: string }) {
  const listing = await prisma.secondaryMarketListing.findUnique({
    where: { id: input.listingId }
  });

  if (!listing || listing.status !== 'OPEN') {
    throw new Error('LISTING_NOT_FOUND');
  }

  if (listing.sellerUserId === input.buyerUserId) {
    throw new Error('CANNOT_BUY_OWN_LISTING');
  }

  const buyerContext = await getUserPurchaseContext(input.buyerUserId);
  if (!buyerContext) {
    throw new Error('BUYER_NOT_FOUND');
  }

  assertInvestorCheckoutEligible(buyerContext);

  const sellerContext = await getUserPurchaseContext(listing.sellerUserId);
  if (!sellerContext?.investorId) {
    throw new Error('SELLER_HAS_NO_INVESTOR');
  }

  const buyerWallet =
    buyerContext.walletAddress?.trim() ||
    `secondary-buyer-${input.buyerUserId.slice(0, 8)}`;

  const buyerInvestorId = await ensureInvestorForUser(buyerContext, buyerWallet);

  const pricePerTokenUsd = listing.pricePerTokenUsd.toNumber();
  const totalUsd = pricePerTokenUsd * listing.tokenCount;
  const txHash = `secondary-${Date.now().toString(36)}-${listing.id}`;
  const idempotencyKey = `secondary-p2p:${listing.id}:${input.buyerUserId}`;

  await debitPlatformWalletForPurchase({
    userId: input.buyerUserId,
    investorId: buyerInvestorId,
    amountUsd: totalUsd,
    idempotencyKey,
    metadata: {
      source: 'SECONDARY_P2P_BUY',
      listingId: listing.id,
      projectId: listing.projectId,
      tokenCount: listing.tokenCount,
      sellerUserId: listing.sellerUserId
    }
  });

  await creditPlatformWallet({
    userId: listing.sellerUserId,
    investorId: sellerContext.investorId,
    amountUsd: totalUsd,
    idempotencyKey: `${idempotencyKey}:seller`,
    metadata: {
      source: 'SECONDARY_P2P_SELL',
      listingId: listing.id,
      projectId: listing.projectId,
      tokenCount: listing.tokenCount,
      buyerUserId: input.buyerUserId
    }
  });

  await prisma.$transaction(async (tx) => {
    const current = await tx.secondaryMarketListing.findUniqueOrThrow({
      where: { id: listing.id }
    });

    if (current.status !== 'OPEN') {
      throw new Error('LISTING_NOT_AVAILABLE');
    }

    const sellerInvestment = await tx.investment.findFirst({
      where: {
        investorId: sellerContext.investorId,
        projectId: current.projectId,
        status: 'ACTIVE'
      },
      orderBy: { purchasedAt: 'asc' }
    });

    if (!sellerInvestment || sellerInvestment.tokenCount < current.tokenCount) {
      throw new Error('INSUFFICIENT_SELLER_TOKENS');
    }

    const remainingSellerTokens = sellerInvestment.tokenCount - current.tokenCount;

    await tx.investment.update({
      where: { id: sellerInvestment.id },
      data: {
        tokenCount: remainingSellerTokens,
        status: remainingSellerTokens === 0 ? 'LIQUIDATED' : 'ACTIVE'
      }
    });

    const buyerInvestment = await tx.investment.findFirst({
      where: {
        investorId: buyerInvestorId,
        projectId: current.projectId,
        status: 'ACTIVE'
      }
    });

    if (buyerInvestment) {
      await tx.investment.update({
        where: { id: buyerInvestment.id },
        data: {
          tokenCount: buyerInvestment.tokenCount + current.tokenCount,
          purchasePriceUsd: buyerInvestment.purchasePriceUsd.toNumber() + totalUsd
        }
      });
    } else {
      await tx.investment.create({
        data: {
          investorId: buyerInvestorId,
          projectId: current.projectId,
          tokenCount: current.tokenCount,
          purchasePriceUsd: totalUsd,
          status: 'ACTIVE',
          txHash
        }
      });
    }

    await tx.secondaryMarketListing.update({
      where: { id: current.id },
      data: {
        status: 'FILLED',
        buyerUserId: input.buyerUserId,
        txHash,
        filledAt: new Date()
      }
    });
  });

  return {
    listingId: listing.id,
    projectId: listing.projectId,
    tokenCount: listing.tokenCount,
    totalUsd,
    txHash
  };
}

export async function getSecondaryListingQuote(listingId: string) {
  const listing = await prisma.secondaryMarketListing.findUnique({
    where: { id: listingId },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          tokenSymbol: true,
          pricePerToken: true
        }
      }
    }
  });

  if (!listing || listing.status !== 'OPEN') {
    throw new Error('LISTING_NOT_FOUND');
  }

  const pricePerTokenUsd = listing.pricePerTokenUsd.toNumber();

  return {
    listingId: listing.id,
    projectId: listing.projectId,
    projectTitle: listing.project.title,
    tokenSymbol: listing.project.tokenSymbol ?? 'RWA',
    tokenCount: listing.tokenCount,
    pricePerTokenUsd,
    totalUsd: pricePerTokenUsd * listing.tokenCount,
    side: 'SELL' as const
  };
}

export async function getPlatformBuybackQuote(input: { projectId: string; tokenCount: number }) {
  if (!Number.isInteger(input.tokenCount) || input.tokenCount <= 0) {
    throw new Error('INVALID_TOKEN_COUNT');
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      title: true,
      tokenSymbol: true,
      pricePerToken: true,
      isActive: true
    }
  });

  if (!project?.isActive) {
    throw new Error('PROJECT_NOT_AVAILABLE');
  }

  const referencePriceUsd = project.pricePerToken.toNumber();
  const pricePerTokenUsd = Number((referencePriceUsd * (1 - PLATFORM_BUYBACK_DISCOUNT)).toFixed(2));

  return {
    projectId: project.id,
    projectTitle: project.title,
    tokenSymbol: project.tokenSymbol ?? 'RWA',
    tokenCount: input.tokenCount,
    pricePerTokenUsd,
    referencePriceUsd,
    discountPercent: Math.round(PLATFORM_BUYBACK_DISCOUNT * 100),
    totalUsd: pricePerTokenUsd * input.tokenCount,
    side: 'BUY' as const
  };
}

export async function executePlatformBuyback(input: {
  userId: string;
  projectId: string;
  tokenCount: number;
}) {
  if (!Number.isInteger(input.tokenCount) || input.tokenCount <= 0) {
    throw new Error('INVALID_TOKEN_COUNT');
  }

  const buyerContext = await getUserPurchaseContext(input.userId);
  if (!buyerContext) {
    throw new Error('USER_NOT_FOUND');
  }

  await assertInvestorCheckoutEligible(buyerContext);

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, pricePerToken: true, isActive: true, tokenSymbol: true, title: true }
  });

  if (!project?.isActive) {
    throw new Error('PROJECT_NOT_AVAILABLE');
  }

  const holdings = await getSecondaryMarketHoldings(input.userId);
  const holding = holdings.find((row) => row.projectId === input.projectId);

  if (!holding || holding.availableToSell < input.tokenCount) {
    throw new Error('INSUFFICIENT_TOKENS');
  }

  const referencePriceUsd = project.pricePerToken.toNumber();
  const pricePerTokenUsd = Number((referencePriceUsd * (1 - PLATFORM_BUYBACK_DISCOUNT)).toFixed(2));
  const totalUsd = pricePerTokenUsd * input.tokenCount;
  const idempotencyKey = `platform-buyback:${input.userId}:${input.projectId}:${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { investorId: true }
    });

    if (!user.investorId) {
      throw new Error('INVESTOR_NOT_FOUND');
    }

    const sellerInvestment = await tx.investment.findFirst({
      where: {
        investorId: user.investorId,
        projectId: input.projectId,
        status: 'ACTIVE'
      },
      orderBy: { purchasedAt: 'asc' }
    });

    if (!sellerInvestment || sellerInvestment.tokenCount < input.tokenCount) {
      throw new Error('INSUFFICIENT_TOKENS');
    }

    const remainingSellerTokens = sellerInvestment.tokenCount - input.tokenCount;

    await tx.investment.update({
      where: { id: sellerInvestment.id },
      data: {
        tokenCount: remainingSellerTokens,
        status: remainingSellerTokens === 0 ? 'LIQUIDATED' : 'ACTIVE'
      }
    });
  });

  await creditPlatformWallet({
    userId: input.userId,
    investorId: buyerContext.investorId,
    amountUsd: totalUsd,
    idempotencyKey,
    metadata: {
      source: 'SECONDARY_PLATFORM_BUYBACK',
      projectId: input.projectId,
      tokenCount: input.tokenCount,
      pricePerTokenUsd,
      referencePriceUsd
    }
  });

  return {
    projectId: input.projectId,
    projectTitle: project.title,
    tokenSymbol: project.tokenSymbol ?? 'RWA',
    tokenCount: input.tokenCount,
    pricePerTokenUsd,
    totalUsd
  };
}
