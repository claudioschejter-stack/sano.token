import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../lib/onboarding/requireInvestorSession';
import { isMercadoPagoQrConfigured } from '../../../../lib/payments/mercadoPagoQr/config';
import {
  createMercadoPagoQrOrderForUser,
  mapMercadoPagoQrServiceError,
  normalizeIdempotencyKey
} from '../../../../lib/payments/mercadoPagoQr/service';
import type {
  CreateMercadoPagoQrOrderInput,
  MercadoPagoQrMode
} from '../../../../lib/payments/mercadoPagoQr/types';

export const dynamic = 'force-dynamic';

type CreateQrBody = {
  amount?: number;
  description?: string;
  external_reference?: string;
  items?: CreateMercadoPagoQrOrderInput['items'];
  mode?: MercadoPagoQrMode;
  expiration_time?: string;
};

export async function POST(request: Request) {
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

  try {
    const body = (await request.json()) as CreateQrBody;
    const idempotencyKey = normalizeIdempotencyKey(request.headers.get('X-Idempotency-Key'));

    const order = await createMercadoPagoQrOrderForUser({
      userId: ctx.userId,
      idempotencyKey,
      payload: {
        amount: Number(body.amount),
        description: body.description?.trim() ?? '',
        external_reference: body.external_reference?.trim() ?? '',
        items: body.items ?? [],
        mode: body.mode,
        expiration_time: body.expiration_time
      }
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    const mapped = mapMercadoPagoQrServiceError(error);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }
}
