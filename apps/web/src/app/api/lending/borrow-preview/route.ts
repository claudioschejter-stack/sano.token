import { NextResponse } from 'next/server';
import { previewMorphoBorrowForProject } from '../../../../lib/lending/borrowRouter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      projectId?: string;
      walletAddress?: string;
      amountUsd?: number;
    };

    if (!body.projectId?.trim() || !body.walletAddress?.trim()) {
      return NextResponse.json({ error: 'projectId and walletAddress required' }, { status: 400 });
    }

    const preview = await previewMorphoBorrowForProject({
      projectId: body.projectId.trim(),
      walletAddress: body.walletAddress.trim(),
      amountUsd: body.amountUsd != null ? Number(body.amountUsd) : undefined
    });

    if (!preview) {
      return NextResponse.json({ error: 'Morpho borrow preview unavailable' }, { status: 404 });
    }

    return NextResponse.json({ preview });
  } catch (error) {
    console.error('[lending/borrow-preview]', error);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
