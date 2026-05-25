import { NextResponse } from 'next/server';
import { requireOperationalSession } from '../../../../lib/onboarding/requireOperationalSession';
import { createSecondaryListing } from '../../../../lib/secondaryMarket/secondaryMarketService';

export async function POST(request: Request) {
  const ctx = await requireOperationalSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('kycRequired' in ctx) {
    return NextResponse.json({ error: 'KYC_REQUIRED' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      projectId?: string;
      tokenCount?: number;
      pricePerTokenUsd?: number;
    };

    if (!body.projectId) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const listing = await createSecondaryListing({
      userId: ctx.userId,
      projectId: body.projectId,
      tokenCount: Number(body.tokenCount),
      pricePerTokenUsd: Number(body.pricePerTokenUsd)
    });

    return NextResponse.json({ ok: true, listing }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'INVALID_TOKEN_COUNT' ||
      message === 'INVALID_PRICE' ||
      message === 'INSUFFICIENT_TOKENS' ||
      message === 'PROJECT_NOT_AVAILABLE'
        ? 400
        : 500;

    console.error('[secondary-market/listings POST]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
