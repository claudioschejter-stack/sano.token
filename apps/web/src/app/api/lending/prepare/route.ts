import { NextResponse } from 'next/server';
import { prepareBorrow } from '../../../../lib/lending/borrowRouter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

    const prepared = await prepareBorrow({
      amountUsd: Number(body.amountUsd),
      collateralEth: body.collateralEth != null ? Number(body.collateralEth) : undefined,
      walletAddress: body.walletAddress.trim(),
      projectId: body.projectId,
      vaultAddress: body.vaultAddress,
      preferProtocol: body.preferProtocol
    });

    if (!prepared) {
      return NextResponse.json(
        { error: 'Unable to prepare borrow transaction. Check protocol, collateral, and Morpho oracle config.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ prepared });
  } catch (error) {
    console.error('[lending/prepare]', error);
    return NextResponse.json({ error: 'Prepare failed' }, { status: 500 });
  }
}
