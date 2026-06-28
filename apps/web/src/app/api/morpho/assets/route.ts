import { NextResponse } from 'next/server';

const MORPHO_BLUE_API = 'https://blue-api.morpho.org/graphql';

const ASSETS_QUERY = `
  query GetAssetsWithPriceAndYield {
    assets(where: { symbol_in: ["wstETH", "WETH", "USDC", "USDT", "cbETH"], chainId_in: [1, 8453] }) {
      items {
        symbol
        address
        price(maxLag: 12) {
          usd
          timestamp
        }
        yield {
          apr
          lookback
        }
        chain {
          id
          network
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
      body: JSON.stringify({ query: ASSETS_QUERY }),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch asset data' }, { status: 502 });
    }

    const json = await res.json() as {
      data?: { assets?: { items?: unknown[] } };
      errors?: unknown[];
    };

    if (json.errors) {
      return NextResponse.json({ error: 'Morpho API error', details: json.errors }, { status: 502 });
    }

    const items = json.data?.assets?.items ?? [];

    return NextResponse.json(
      { assets: items, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
