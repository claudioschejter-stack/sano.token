import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../lib/onboarding/requireInvestorSession';
import { createMercadoPagoDirectPreference } from '../../../../lib/checkout/mercadoPagoDirectCheckoutService';

export const dynamic = 'force-dynamic';

type MercadoPagoCheckoutBody = {
  amountUsd?: number;
  referenceId?: string;
  title?: string;
  country?: string;
};

export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  try {
    const body = (await request.json()) as MercadoPagoCheckoutBody;
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
    }

    const referenceId = body.referenceId?.trim() || randomUUID();
    const country = body.country?.trim().toUpperCase() || 'AR';

    const preference = await createMercadoPagoDirectPreference({
      amountUsd,
      externalReference: referenceId,
      title: body.title?.trim() || 'Inversión Sanova Capital',
      country,
      metadata: {
        userId: ctx.userId,
        referenceId,
        checkoutRoute: 'local_fiat_mercadopago'
      }
    });

    if (preference.ok === false) {
      return NextResponse.json({ error: preference.error, sandbox: preference.sandbox }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      session: preference.session
    });
  } catch (error) {
    console.error('[api/checkout/mercadopago]', error);
    return NextResponse.json({ error: 'CHECKOUT_CREATE_FAILED' }, { status: 500 });
  }
}
