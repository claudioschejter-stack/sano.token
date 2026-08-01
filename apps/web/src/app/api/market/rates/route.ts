import { NextResponse } from 'next/server';
import { fetchMarketRatesSnapshot } from '../../../../lib/market/marketRates';

export const dynamic = 'force-dynamic';

/** Free FX + stablecoin USD peg snapshot for wallet / checkout valuation. */
export async function GET() {
  try {
    const rates = await fetchMarketRatesSnapshot();
    return NextResponse.json({ ok: true, rates });
  } catch (error) {
    console.error('[api/market/rates]', error);
    return NextResponse.json({ error: 'MARKET_RATES_FAILED' }, { status: 502 });
  }
}
