import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { isEvmAutoUsdcNetwork, prepareUsdcTreasuryPayment } from '../../../../../lib/web3/usdcTreasuryTransfer';

type PrepareBody = {
  amountUsd?: number;
  stablecoinNetwork?: string;
  payerAddress?: string;
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as PrepareBody;
    const amountUsd = Number(body.amountUsd);
    const stablecoinNetwork = body.stablecoinNetwork?.trim().toUpperCase() || 'BASE';
    const payerAddress = body.payerAddress?.trim();

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
    }

    if (!payerAddress) {
      return NextResponse.json({ error: 'PAYER_ADDRESS_REQUIRED' }, { status: 400 });
    }

    if (!isEvmAutoUsdcNetwork(stablecoinNetwork)) {
      return NextResponse.json({ error: 'NETWORK_NOT_SUPPORTED' }, { status: 400 });
    }

    const prepared = await prepareUsdcTreasuryPayment({
      amountUsd,
      stablecoinNetwork,
      payerAddress
    });

    return NextResponse.json({ prepared });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PREPARE_FAILED';
    const status =
      message === 'BRIDGE_NOT_CONFIGURED' || message === 'TREASURY_NOT_CONFIGURED'
        ? 503
        : message === 'NETWORK_NOT_SUPPORTED'
          ? 400
          : 500;
    console.error('[payments/usdc/prepare]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
