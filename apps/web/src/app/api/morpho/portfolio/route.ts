import { NextResponse } from 'next/server';

const MORPHO_BLUE_API = 'https://blue-api.morpho.org/graphql';

// Sanova treasury / operator address on Ethereum mainnet
const SANOVA_ADDRESS = '0x821880a3E2bac432d67E5155e72BB655Ef65fa5E';
const CHAIN_ID = 1;

const PORTFOLIO_QUERY = `
  query {
    userByAddress(
      chainId: ${CHAIN_ID}
      address: "${SANOVA_ADDRESS}"
    ) {
      address
      marketPositions {
        market {
          marketId
          loanAsset { address symbol }
          collateralAsset { address symbol }
        }
        state {
          borrowAssets
          borrowAssetsUsd
          supplyAssets
          supplyAssetsUsd
        }
      }
      vaultPositions {
        vault {
          address
          name
        }
        state {
          assets
          assetsUsd
          shares
        }
      }
      vaultV2Positions {
        vault {
          address
          name
        }
        assets
        assetsUsd
        shares
      }
    }
    vaultV1Transactions(
      first: 10
      orderBy: Time
      orderDirection: Desc
      where: {
        userAddress_in: ["${SANOVA_ADDRESS}"]
        chainId_in: [${CHAIN_ID}]
      }
    ) {
      items {
        txHash
        timestamp
        type
      }
    }
    marketTransactions(
      first: 10
      orderBy: Timestamp
      orderDirection: Desc
      where: {
        userAddress_in: ["${SANOVA_ADDRESS}"]
        chainId_in: [${CHAIN_ID}]
      }
    ) {
      items {
        txHash
        timestamp
        type
      }
    }
    vaultV2transactions(
      first: 10
      orderBy: Time
      orderDirection: Desc
      where: {
        userAddress_in: ["${SANOVA_ADDRESS}"]
        chainId_in: [${CHAIN_ID}]
      }
    ) {
      items {
        txHash
        timestamp
        type
        shares
        assets
        vault {
          address
          name
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
      body: JSON.stringify({ query: PORTFOLIO_QUERY }),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch portfolio data' }, { status: 502 });
    }

    const json = await res.json() as {
      data?: unknown;
      errors?: unknown[];
    };

    if (json.errors) {
      return NextResponse.json({ error: 'Morpho API error', details: json.errors }, { status: 502 });
    }

    return NextResponse.json(
      { portfolio: json.data, address: SANOVA_ADDRESS, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
