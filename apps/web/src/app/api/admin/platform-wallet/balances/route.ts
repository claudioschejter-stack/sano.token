import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { getPlatformWalletBalances } from '../../../../../lib/admin/platformWalletBalances';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const totalTokensRaw = request.nextUrl.searchParams.get('totalTokens');
  const pricePerTokenRaw = request.nextUrl.searchParams.get('pricePerToken');
  const totalTokens = totalTokensRaw ? Number.parseFloat(totalTokensRaw) : undefined;
  const pricePerToken = pricePerTokenRaw ? Number.parseFloat(pricePerTokenRaw) : undefined;

  return NextResponse.json(
    await getPlatformWalletBalances({
      totalTokens: Number.isFinite(totalTokens) ? totalTokens : undefined,
      pricePerToken: Number.isFinite(pricePerToken) ? pricePerToken : undefined
    })
  );
}
