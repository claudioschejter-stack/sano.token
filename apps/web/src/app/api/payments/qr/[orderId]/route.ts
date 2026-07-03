import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../lib/onboarding/requireInvestorSession';
import { isMercadoPagoQrConfigured } from '../../../../../lib/payments/mercadoPagoQr/config';
import {
  getMercadoPagoQrOrderStatusForUser,
  mapMercadoPagoQrServiceError
} from '../../../../../lib/payments/mercadoPagoQr/service';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }

  if (!isMercadoPagoQrConfigured()) {
    return NextResponse.json({ error: 'MP_QR_NOT_CONFIGURED' }, { status: 503 });
  }

  const { orderId } = await context.params;

  try {
    const order = await getMercadoPagoQrOrderStatusForUser({
      userId: ctx.userId,
      orderId
    });
    return NextResponse.json({ order });
  } catch (error) {
    const mapped = mapMercadoPagoQrServiceError(error);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }
}
