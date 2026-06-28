import { NextResponse } from 'next/server';

const MORPHO_BLUE_API = 'https://blue-api.morpho.org/graphql';

// Market: wstETH/USDC on Ethereum — Sanova primary liquidity market
const MARKET_KEY = '0x698fe98247a40c5771537b5786b2f3f9d78eb487b4ce4d75533cd0e94d88a115';

const POSITIONS_QUERY = `
  query {
    topSuppliers: marketPositions(
      first: 10
      orderBy: SupplyShares
      orderDirection: Desc
      where: { marketUniqueKey_in: ["${MARKET_KEY}"] }
    ) {
      items {
        market {
          marketId
          loanAsset { address symbol }
          collateralAsset { address symbol }
        }
        user { address }
        state {
          supplyShares
          supplyAssets
          supplyAssetsUsd
          borrowShares
          borrowAssets
          borrowAssetsUsd
          collateral
          collateralUsd
        }
      }
    }
    topBorrowers: marketPositions(
      first: 10
      orderBy: BorrowShares
      orderDirection: Desc
      where: { marketUniqueKey_in: ["${MARKET_KEY}"] }
    ) {
      items {
        user { address }
        state {
          collateral
          borrowAssets
          borrowAssetsUsd
        }
      }
    }
  }
`;

export const revalidate = 300;

export async function GET() {
  try {
    const res = await fetch(MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: POSITIONS_QUERY }),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 502 });
    }

    const json = await res.json() as {
      data?: unknown;
      errors?: unknown[];
    };

    if (json.errors) {
      return NextResponse.json({ error: 'Morpho API error', details: json.errors }, { status: 502 });
    }

    return NextResponse.json(
      { positions: json.data, marketKey: MARKET_KEY, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
