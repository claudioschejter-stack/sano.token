import { NextResponse } from 'next/server';
import { requireInvestorOperationalSession } from '../../../../../lib/onboarding/requireOperationalSession';
import {
  buySecondaryListing,
  cancelSecondaryListing
} from '../../../../../lib/secondaryMarket/secondaryMarketService';

export async function POST(
  _request: Request,
  context: { params: Promise<{ listingId: string }> }
) {
  const ctx = await requireInvestorOperationalSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('kycRequired' in ctx) {
    return NextResponse.json({ error: 'KYC_REQUIRED' }, { status: 403 });
  }

  if ('investorRequired' in ctx || 'investorAccessDisabled' in ctx) {
    return NextResponse.json({ error: 'INVESTOR_ACCESS_NOT_ENABLED' }, { status: 403 });
  }

  const { listingId } = await context.params;

  try {
    const result = await buySecondaryListing({
      buyerUserId: ctx.userId,
      listingId
    });

    return NextResponse.json({ ok: true, purchase: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'LISTING_NOT_FOUND' ||
      message === 'LISTING_NOT_AVAILABLE' ||
      message === 'CANNOT_BUY_OWN_LISTING' ||
      message === 'INSUFFICIENT_SELLER_TOKENS' ||
      message === 'INSUFFICIENT_PLATFORM_BALANCE' ||
      message === 'INVESTOR_ACCESS_NOT_ENABLED' ||
      message === 'INVESTOR_WALLET_REQUIRED' ||
      message === 'ACCOUNT_NOT_OPERATIONAL' ||
      message === 'KYC_NOT_APPROVED'
        ? 400
        : 500;

    console.error('[secondary-market/listings/buy POST]', message);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ listingId: string }> }
) {
  const ctx = await requireInvestorOperationalSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('kycRequired' in ctx) {
    return NextResponse.json({ error: 'KYC_REQUIRED' }, { status: 403 });
  }

  if ('investorRequired' in ctx || 'investorAccessDisabled' in ctx) {
    return NextResponse.json({ error: 'INVESTOR_ACCESS_NOT_ENABLED' }, { status: 403 });
  }

  const { listingId } = await context.params;

  try {
    await cancelSecondaryListing({ userId: ctx.userId, listingId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      message === 'LISTING_NOT_FOUND' ? 404 : message === 'FORBIDDEN' ? 403 : 500;

    console.error('[secondary-market/listings DELETE]', message);
    return NextResponse.json({ error: message }, { status });
  }
}
