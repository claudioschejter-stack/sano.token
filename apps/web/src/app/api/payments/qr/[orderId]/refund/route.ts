import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../../../lib/onboarding/requireInvestorSession';
import { isMercadoPagoQrConfigured } from '../../../../../../lib/payments/mercadoPagoQr/config';
import {
  mapMercadoPagoQrServiceError,
  normalizeIdempotencyKey,
  refundMercadoPagoQrOrderForUser
} from '../../../../../../lib/payments/mercadoPagoQr/service';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

type RefundBody = {
  amount?: number;
};

export async function POST(request: Request, context: RouteContext) {
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
  const idempotencyKey = normalizeIdempotencyKey(request.headers.get('X-Idempotency-Key'));

  let amount: number | undefined;
  try {
    const body = (await request.json()) as RefundBody;
    if (body.amount !== undefined) {
      amount = Number(body.amount);
    }
  } catch {
    amount = undefined;
  }

  try {
    const order = await refundMercadoPagoQrOrderForUser({
      userId: ctx.userId,
      orderId,
      idempotencyKey,
      amount
    });
    return NextResponse.json({ order });
  } catch (error) {
    const mapped = mapMercadoPagoQrServiceError(error);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }
}
