import { NextResponse } from 'next/server';
import { getPlatformBuybackQuote } from '../../../../../lib/secondaryMarket/secondaryMarketService';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const tokenCount = Number.parseInt(url.searchParams.get('tokenCount') ?? '1', 10);

  if (!projectId) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  try {
    const quote = await getPlatformBuybackQuote({ projectId, tokenCount });
    return NextResponse.json({ quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
