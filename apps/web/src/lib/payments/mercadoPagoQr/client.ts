import { mercadoPagoAccessToken } from '../mercadoPagoClient';
import { MP_ORDERS_BASE_URL } from './config';
import type {
  CreateMercadoPagoQrOrderInput,
  MercadoPagoQrMode,
  MercadoPagoQrOrderApiResponse,
  MercadoPagoQrOrderItemInput
} from './types';

export class MercadoPagoQrApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`MERCADOPAGO_QR_API_${status}`);
    this.name = 'MercadoPagoQrApiError';
    this.status = status;
    this.body = body;
  }
}

type MpRequestOptions = {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  idempotencyKey?: string;
  body?: Record<string, unknown>;
};

async function mpOrdersRequest<T>(options: MpRequestOptions): Promise<T> {
  const accessToken = mercadoPagoAccessToken();
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN_NOT_CONFIGURED');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
  if (options.idempotencyKey) {
    headers['X-Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(`${MP_ORDERS_BASE_URL}${options.path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  if (!response.ok) {
    throw new MercadoPagoQrApiError(response.status, text);
  }

  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function normalizeItems(items: MercadoPagoQrOrderItemInput[]) {
  return items.map((item) => ({
    title: item.title,
    unit_price: formatAmount(item.unit_price),
    quantity: item.quantity,
    unit_measure: item.unit_measure ?? 'unit',
    ...(item.external_code ? { external_code: item.external_code } : {})
  }));
}

export function buildMercadoPagoQrOrderPayload(input: {
  amount: number;
  description: string;
  external_reference: string;
  items: MercadoPagoQrOrderItemInput[];
  external_pos_id: string;
  mode: MercadoPagoQrMode;
  expiration_time: string;
}): Record<string, unknown> {
  const items = normalizeItems(input.items);
  const totalAmount = formatAmount(input.amount);

  return {
    type: 'qr',
    external_reference: input.external_reference,
    description: input.description,
    expiration_time: input.expiration_time,
    processing_mode: 'automatic',
    total_amount: totalAmount,
    config: {
      qr: {
        external_pos_id: input.external_pos_id,
        mode: input.mode
      }
    },
    transactions: {
      payments: [{ amount: totalAmount }]
    },
    items
  };
}

export async function createMercadoPagoQrOrderApi(
  input: CreateMercadoPagoQrOrderInput & {
    external_pos_id: string;
    mode: MercadoPagoQrMode;
    expiration_time: string;
  },
  idempotencyKey: string
): Promise<MercadoPagoQrOrderApiResponse> {
  const body = buildMercadoPagoQrOrderPayload(input);
  return mpOrdersRequest<MercadoPagoQrOrderApiResponse>({
    method: 'POST',
    path: '',
    idempotencyKey,
    body
  });
}

export async function getMercadoPagoQrOrderApi(
  mpOrderId: string
): Promise<MercadoPagoQrOrderApiResponse> {
  return mpOrdersRequest<MercadoPagoQrOrderApiResponse>({
    method: 'GET',
    path: `/${encodeURIComponent(mpOrderId)}`
  });
}

export async function cancelMercadoPagoQrOrderApi(
  mpOrderId: string,
  idempotencyKey: string
): Promise<MercadoPagoQrOrderApiResponse> {
  return mpOrdersRequest<MercadoPagoQrOrderApiResponse>({
    method: 'POST',
    path: `/${encodeURIComponent(mpOrderId)}/cancel`,
    idempotencyKey
  });
}

export async function refundMercadoPagoQrOrderApi(
  mpOrderId: string,
  idempotencyKey: string,
  amount?: number
): Promise<MercadoPagoQrOrderApiResponse> {
  const body =
    amount !== undefined
      ? {
          transactions: {
            payments: [{ amount: formatAmount(amount) }]
          }
        }
      : undefined;

  return mpOrdersRequest<MercadoPagoQrOrderApiResponse>({
    method: 'POST',
    path: `/${encodeURIComponent(mpOrderId)}/refund`,
    idempotencyKey,
    body
  });
}
