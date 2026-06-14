import { NextResponse } from 'next/server';
import type { PaymentMethod } from '@sanova/database';
import { investorSessionForbiddenResponse, requireInvestorSession } from '../../../../lib/onboarding/requireInvestorSession';
import { getPaymentCheckoutRowById } from '../../../../lib/payments/depositPaymentOptions';
import { isDepositCheckoutRowConfigured } from '../../../../lib/payments/paymentProviderAvailability';
import { createPlatformDeposit } from '../../../../lib/payments/platformWalletService';
import { chooseCheapestPaymentRoute, quoteCheapestPaymentRoutes, type PaymentRouteDirection } from '../../../../lib/payments/cheapestPaymentRouter';
import { prisma } from '@sanova/database';
import { resolveOperationalWalletAddress } from '../../../../lib/investor/provisionInvestorProfile';

export const dynamic = 'force-dynamic';

type DepositBody = {
  amountUsd?: number;
  method?: PaymentMethod;
  paymentOptionId?: string;
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
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const body = (await request.json()) as DepositBody;
    const amountUsd = Number(body.amountUsd);
    const checkoutRow = body.paymentOptionId ? getPaymentCheckoutRowById(body.paymentOptionId) : null;
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { walletAddress: true, investor: { select: { walletAddress: true } } }
    });
    const linkedWalletAddress = user
      ? resolveOperationalWalletAddress(user.walletAddress, user.investor?.walletAddress) ??
        (body.walletAddress?.trim() ? body.walletAddress.trim() : null)
      : body.walletAddress ?? null;

    if (checkoutRow && !isDepositCheckoutRowConfigured(checkoutRow, { linkedWalletAddress })) {
      return NextResponse.json({ error: 'PAYMENT_OPTION_NOT_CONFIGURED' }, { status: 400 });
    }

    const auto = body.auto === true || (!body.method && !checkoutRow);
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
    const method =
      checkoutRow?.method ??
      route?.method ??
      (body.method && METHODS.has(body.method) ? body.method : 'USDC_ONCHAIN');
    const deposit = await createPlatformDeposit({
      userId: ctx.userId,
      amountUsd,
      method,
      paymentOptionId: checkoutRow?.id ?? body.paymentOptionId,
      walletAddress: body.walletAddress ?? linkedWalletAddress,
      stablecoinNetwork: route?.stablecoinNetwork ?? body.stablecoinNetwork ?? checkoutRow?.stablecoinNetwork,
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
    if (
      [
        'USER_NOT_FOUND',
        'ACCOUNT_NOT_OPERATIONAL',
        'KYC_NOT_APPROVED',
        'INVALID_DEPOSIT_AMOUNT',
        'PAYMENT_OPTION_NOT_CONFIGURED',
        'WALLET_MISMATCH',
        'WALLET_REQUIRED',
        'INVESTOR_WALLET_REQUIRED',
        'CHAIN_MISMATCH',
        'INVALID_WALLET'
      ].includes(message)
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[wallet/deposit-intents]', error);
    return NextResponse.json({ error: 'DEPOSIT_CREATE_FAILED' }, { status: 500 });
  }
}
