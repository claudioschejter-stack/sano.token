import { NextResponse } from 'next/server';

const MORPHO_BLUE_API = 'https://blue-api.morpho.org/graphql';

const MARKETS_QUERY = `
  query {
    markets(
      first: 100
      orderBy: SupplyAssetsUsd
      orderDirection: Desc
      where: { chainId_in: [1, 8453] }
    ) {
      items {
        marketId
        lltv
        oracle {
          address
        }
        irmAddress
        loanAsset {
          address
          symbol
          decimals
        }
        collateralAsset {
          address
          symbol
          decimals
        }
        state {
          borrowAssetsUsd
          supplyAssetsUsd
          fee
          utilization
        }
        dailyApys {
          supplyApy
          borrowApy
        }
        chain {
          id
          network
        }
      }
    }
  }
`;

export const revalidate = 300; // revalidate every 5 minutes

export async function GET() {
  try {
    const res = await fetch(MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: MARKETS_QUERY }),
      next: { revalidate: 300 }
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch Morpho data' }, { status: 502 });
    }

    const json = await res.json() as { data?: { markets?: { items?: unknown[] } }; errors?: unknown[] };

    if (json.errors) {
      return NextResponse.json({ error: 'Morpho API error', details: json.errors }, { status: 502 });
    }

    const items = json.data?.markets?.items ?? [];

    return NextResponse.json(
      { markets: items, fetchedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
        }
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
