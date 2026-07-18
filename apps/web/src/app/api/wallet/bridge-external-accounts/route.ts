import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../lib/onboarding/requireInvestorSession';
import {
  linkUserBridgeExternalAccount,
  listUserBridgeExternalAccounts
} from '../../../../lib/payments/bridgeExternalAccountsService';
import type { CreateBridgeExternalAccountInput } from '../../../../lib/payments/bridgeClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const session = await auth();
  const email = session?.user?.email;
  const fullName = session?.user?.name?.trim() || 'Sanova Investor';
  if (!email) {
    return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 });
  }

  const result = await listUserBridgeExternalAccounts({
    userId: ctx.userId,
    email,
    fullName
  });

  if (!result.ok) {
    const status = result.reason === 'KYC_REQUIRED' ? 409 : 503;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({ ok: true, accounts: result.accounts });
}

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  const session = await auth();
  const email = session?.user?.email;
  const fullName = session?.user?.name?.trim() || 'Sanova Investor';
  if (!email) {
    return NextResponse.json({ error: 'EMAIL_REQUIRED' }, { status: 400 });
  }

  const body = (await request.json()) as CreateBridgeExternalAccountInput;
  if (!body?.currency || !['usd', 'eur', 'mxn'].includes(body.currency)) {
    return NextResponse.json({ error: 'INVALID_CURRENCY' }, { status: 400 });
  }

  const result = await linkUserBridgeExternalAccount({
    userId: ctx.userId,
    email,
    fullName,
    body
  });

  if (!result.ok) {
    const status =
      result.reason === 'KYC_REQUIRED' ? 409 : result.reason === 'BRIDGE_NOT_CONFIGURED' ? 503 : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({ ok: true, account: result.account });
}
