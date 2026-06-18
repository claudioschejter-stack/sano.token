import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { isEvmAutoUsdcNetwork } from '../../../../../lib/web3/usdcTreasuryTransfer';
import { prepareVaultDepositPayment, type VaultDepositLine } from '../../../../../lib/web3/vaultDepositPayment';

type PrepareBody = {
  stablecoinNetwork?: string;
  payerAddress?: string;
  deposits?: VaultDepositLine[];
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as PrepareBody;
    const stablecoinNetwork = body.stablecoinNetwork?.trim().toUpperCase() || 'BASE';
    const payerAddress = body.payerAddress?.trim();
    const deposits = body.deposits ?? [];

    if (!payerAddress) {
      return NextResponse.json({ error: 'PAYER_ADDRESS_REQUIRED' }, { status: 400 });
    }

    if (!isEvmAutoUsdcNetwork(stablecoinNetwork)) {
      return NextResponse.json({ error: 'NETWORK_NOT_SUPPORTED' }, { status: 400 });
    }

    const prepared = prepareVaultDepositPayment({
      stablecoinNetwork,
      payerAddress,
      deposits
    });

    return NextResponse.json({ prepared });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PREPARE_FAILED';
    const status =
      message === 'NETWORK_NOT_SUPPORTED' ||
      message === 'VAULT_DEPOSIT_LINES_REQUIRED' ||
      message === 'INVALID_VAULT_ADDRESS' ||
      message === 'INVALID_PAYER_ADDRESS'
        ? 400
        : 500;
    console.error('[payments/vault-deposit/prepare]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
