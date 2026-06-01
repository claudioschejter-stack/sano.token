import { NextResponse } from 'next/server';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { prepareMorphoRepay } from '../../../../lib/lending/repayRouter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      projectId?: string;
      walletAddress?: string;
      amountUsd?: number;
    };

    if (!body.projectId?.trim() || !body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'projectId and walletAddress required' }, { status: 400 });
    }

    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ error: 'amountUsd must be greater than zero' }, { status: 400 });
    }

    const prepared = await prepareMorphoRepay({
      userId: ctx.userId,
      projectId: body.projectId.trim(),
      walletAddress: body.walletAddress.trim(),
      amountUsd
    });

    if (!prepared) {
      return NextResponse.json(
        { error: 'Unable to prepare Morpho repay. Check wallet, debt and project.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ prepared });
  } catch (error) {
    console.error('[lending/repay-prepare POST]', error);
    return NextResponse.json({ error: 'Prepare repay failed' }, { status: 500 });
  }
}
