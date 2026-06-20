import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../../lib/onboarding/requireAuthenticatedSession';
import { isPrivyEarnConfigured } from '../../../../../lib/privy/config';
import {
  depositInvestorVaultsViaPrivyEarn,
  readInvestorPrivyEarnPosition
} from '../../../../../lib/privy/investorPrivyEarnService';
import type { VaultDepositLine } from '../../../../../lib/web3/vaultDepositPayment';

export const dynamic = 'force-dynamic';

type DepositBody = {
  privyAccessToken?: string;
  walletAddress?: string;
  deposits?: VaultDepositLine[];
  idempotencyPrefix?: string;
};

export async function POST(request: Request) {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isPrivyEarnConfigured()) {
    return NextResponse.json({ error: 'PRIVY_EARN_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as DepositBody;
    const privyAccessToken = body.privyAccessToken?.trim();
    const walletAddress = body.walletAddress?.trim();
    const deposits = body.deposits ?? [];

    if (!privyAccessToken) {
      return NextResponse.json({ error: 'PRIVY_TOKEN_REQUIRED' }, { status: 400 });
    }
    if (!walletAddress) {
      return NextResponse.json({ error: 'WALLET_ADDRESS_REQUIRED' }, { status: 400 });
    }
    if (!deposits.length) {
      return NextResponse.json({ error: 'VAULT_DEPOSIT_LINES_REQUIRED' }, { status: 400 });
    }

    const result = await depositInvestorVaultsViaPrivyEarn({
      privyAccessToken,
      walletAddress,
      deposits,
      idempotencyPrefix: body.idempotencyPrefix?.trim() || ctx.userId
    });

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PRIVY_EARN_DEPOSIT_FAILED';
    const status =
      message === 'PRIVY_TOKEN_INVALID' ||
      message === 'PRIVY_TOKEN_REQUIRED' ||
      message === 'PRIVY_WALLET_ID_NOT_FOUND' ||
      message === 'PRIVY_EARN_DEPOSIT_NOT_ELIGIBLE' ||
      message === 'PRIVY_EARN_VAULT_NOT_MAPPED'
        ? 400
        : 502;
    console.error('[privy/earn/deposit POST]', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!isPrivyEarnConfigured()) {
    return NextResponse.json({ error: 'PRIVY_EARN_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const privyAccessToken = request.nextUrl.searchParams.get('privyAccessToken')?.trim();
    const walletAddress = request.nextUrl.searchParams.get('walletAddress')?.trim();
    const vaultAddress = request.nextUrl.searchParams.get('vaultAddress');

    if (!privyAccessToken || !walletAddress) {
      return NextResponse.json({ error: 'PRIVY_TOKEN_AND_WALLET_REQUIRED' }, { status: 400 });
    }

    const position = await readInvestorPrivyEarnPosition({
      privyAccessToken,
      walletAddress,
      vaultAddress
    });

    return NextResponse.json({ position });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PRIVY_EARN_POSITION_FAILED';
    console.error('[privy/earn/deposit GET position]', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
