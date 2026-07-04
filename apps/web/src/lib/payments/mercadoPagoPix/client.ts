import { mercadoPagoPixAccessToken } from './config';
import type { CreateMercadoPagoPixPaymentInput, MercadoPagoPixPaymentApiResponse } from './types';

const MP_PAYMENTS_BASE_URL = 'https://api.mercadopago.com/v1/payments';

export class MercadoPagoPixApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`MERCADOPAGO_PIX_API_${status}`);
    this.name = 'MercadoPagoPixApiError';
    this.status = status;
    this.body = body;
  }
}

export async function createMercadoPagoPixPaymentApi(
  input: CreateMercadoPagoPixPaymentInput & { expirationMinutes: number },
  idempotencyKey: string
): Promise<MercadoPagoPixPaymentApiResponse> {
  const accessToken = mercadoPagoPixAccessToken();
  if (!accessToken) {
    throw new Error('MERCADOPAGO_BR_NOT_CONFIGURED');
  }

  const dateOfExpiration = new Date(Date.now() + input.expirationMinutes * 60_000).toISOString();

  const response = await fetch(MP_PAYMENTS_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      transaction_amount: Number(input.amount.toFixed(2)),
      description: input.description,
      payment_method_id: 'pix',
      external_reference: input.external_reference,
      date_of_expiration: dateOfExpiration,
      payer: {
        email: input.payerEmail ?? 'investor@sanovacapital.com'
      }
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new MercadoPagoPixApiError(response.status, text);
  }

  return text ? (JSON.parse(text) as MercadoPagoPixPaymentApiResponse) : {};
}

export async function getMercadoPagoPixPaymentApi(mpPaymentId: string): Promise<MercadoPagoPixPaymentApiResponse> {
  const accessToken = mercadoPagoPixAccessToken();
  if (!accessToken) {
    throw new Error('MERCADOPAGO_BR_NOT_CONFIGURED');
  }

  const response = await fetch(`${MP_PAYMENTS_BASE_URL}/${encodeURIComponent(mpPaymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new MercadoPagoPixApiError(response.status, text);
  }

  return text ? (JSON.parse(text) as MercadoPagoPixPaymentApiResponse) : {};
}
