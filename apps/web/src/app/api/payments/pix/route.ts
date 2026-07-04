import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../lib/onboarding/requireInvestorSession';
import { isMercadoPagoPixConfigured } from '../../../../lib/payments/mercadoPagoPix/config';
import {
  createMercadoPagoPixPaymentForUser,
  mapMercadoPagoPixServiceError,
  normalizePixIdempotencyKey
} from '../../../../lib/payments/mercadoPagoPix/service';

export const dynamic = 'force-dynamic';

type CreatePixBody = {
  amount?: number;
  description?: string;
  external_reference?: string;
};

export async function POST(request: Request) {
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

  try {
    const body = (await request.json()) as CreatePixBody;
    const idempotencyKey = normalizePixIdempotencyKey(request.headers.get('X-Idempotency-Key'));

    const payment = await createMercadoPagoPixPaymentForUser({
      userId: ctx.userId,
      idempotencyKey,
      payload: {
        amount: Number(body.amount),
        description: body.description?.trim() || 'Fondeo Sanova',
        external_reference: body.external_reference?.trim() ?? ''
      }
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const mapped = mapMercadoPagoPixServiceError(error);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }
}
