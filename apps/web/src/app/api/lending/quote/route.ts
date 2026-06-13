import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { quoteBorrow } from '../../../../lib/lending/borrowRouter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
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
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    }

    const quote = await quoteBorrow({
      amountUsd: Number(body.amountUsd),
      walletAddress: body.walletAddress.trim(),
      projectId: body.projectId,
      vaultAddress: body.vaultAddress
    });

    if (!quote) {
      return NextResponse.json({ error: 'No executable borrow quote available' }, { status: 404 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('[lending/quote]', error);
    return NextResponse.json({ error: 'Quote failed' }, { status: 500 });
  }
}
