import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireMorphoBorrowSession
} from '../../../../lib/onboarding/requireInvestorSession';
import { quoteBorrow } from '../../../../lib/lending/borrowRouter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireMorphoBorrowSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const body = (await request.json()) as {
      amountUsd?: number;
      collateralEth?: number;
      walletAddress?: string;
      projectId?: string;
      vaultAddress?: string;
      preferProtocol?: string;
    };

    if (!body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'WALLET_REQUIRED' }, { status: 400 });
    }

    const quote = await quoteBorrow({
      amountUsd: Number(body.amountUsd),
      walletAddress: body.walletAddress.trim(),
      projectId: body.projectId,
      vaultAddress: body.vaultAddress
    });

    if (!quote) {
      return NextResponse.json({ error: 'NO_EXECUTABLE_QUOTE' }, { status: 404 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('[lending/quote]', error);
    return NextResponse.json({ error: 'QUOTE_FAILED' }, { status: 500 });
  }
}
