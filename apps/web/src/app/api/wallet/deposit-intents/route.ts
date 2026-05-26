import { NextResponse } from 'next/server';
import type { PaymentMethod } from '@sanova/database';
import { requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { createPlatformDeposit } from '../../../../lib/payments/platformWalletService';
import { chooseCheapestPaymentRoute, quoteCheapestPaymentRoutes, type PaymentRouteDirection } from '../../../../lib/payments/cheapestPaymentRouter';

export const dynamic = 'force-dynamic';

type DepositBody = {
  amountUsd?: number;
  method?: PaymentMethod;
  auto?: boolean;
  country?: string;
  currency?: string;
  direction?: PaymentRouteDirection;
  userHasStablecoin?: boolean;
  walletAddress?: string;
  stablecoinNetwork?: string;
};

const METHODS = new Set<PaymentMethod>(['USDC_ONCHAIN', 'STRIPE', 'MERCADO_PAGO', 'COINBASE', 'LOCAL_RAIL', 'BRIDGE', 'TRANSAK', 'RAMP']);

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as DepositBody;
    const amountUsd = Number(body.amountUsd);
    const auto = body.auto === true || !body.method;
    const route = auto
      ? chooseCheapestPaymentRoute({
          amountUsd,
          country: body.country,
          currency: body.currency,
          direction: body.direction,
          userHasStablecoin: body.userHasStablecoin,
          preferredNetwork: body.stablecoinNetwork
        })
      : null;
    const method = route?.method ?? (body.method && METHODS.has(body.method) ? body.method : 'USDC_ONCHAIN');
    const deposit = await createPlatformDeposit({
      userId: ctx.userId,
      amountUsd,
      method,
      walletAddress: body.walletAddress,
      stablecoinNetwork: route?.stablecoinNetwork ?? body.stablecoinNetwork,
      routeQuote: route ?? undefined
    });

    return NextResponse.json({
      ok: true,
      deposit,
      selectedRoute: route,
      quotes: quoteCheapestPaymentRoutes({
        amountUsd,
        country: body.country,
        currency: body.currency,
        direction: body.direction,
        userHasStablecoin: body.userHasStablecoin,
        preferredNetwork: body.stablecoinNetwork
      }).slice(0, 5)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    if (['USER_NOT_FOUND', 'ACCOUNT_NOT_OPERATIONAL', 'KYC_NOT_APPROVED', 'INVALID_DEPOSIT_AMOUNT'].includes(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[wallet/deposit-intents]', error);
    return NextResponse.json({ error: 'DEPOSIT_CREATE_FAILED' }, { status: 500 });
  }
}
