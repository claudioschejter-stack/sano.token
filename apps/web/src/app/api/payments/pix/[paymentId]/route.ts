import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { isMercadoPagoPixConfigured } from '../../../../../lib/payments/mercadoPagoPix/config';
import {
  getMercadoPagoPixPaymentStatusForUser,
  mapMercadoPagoPixServiceError
} from '../../../../../lib/payments/mercadoPagoPix/service';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ paymentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  if (!isMercadoPagoPixConfigured()) {
    return NextResponse.json({ error: 'MERCADOPAGO_BR_NOT_CONFIGURED' }, { status: 503 });
  }

  const { paymentId } = await context.params;

  try {
    const payment = await getMercadoPagoPixPaymentStatusForUser({ userId: ctx.userId, paymentId });
    return NextResponse.json({ payment });
  } catch (error) {
    const mapped = mapMercadoPagoPixServiceError(error);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }
}
