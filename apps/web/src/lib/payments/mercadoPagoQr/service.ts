import { randomUUID } from 'node:crypto';
import { prisma } from '@sanova/database';
import {
  cancelMercadoPagoQrOrderApi,
  createMercadoPagoQrOrderApi,
  getMercadoPagoQrOrderApi,
  MercadoPagoQrApiError,
  refundMercadoPagoQrOrderApi
} from './client';
import {
  assertMercadoPagoQrConfigured,
  mercadoPagoQrDefaultExpiration,
  mercadoPagoQrDefaultMode,
  mercadoPagoQrExternalPosId
} from './config';
import {
  findMercadoPagoQrOrderByIdempotencyKey,
  findMercadoPagoQrOrderForUser,
  updateMercadoPagoQrOrderFromApi,
  upsertMercadoPagoQrOrderFromApi
} from './repository';
import type {
  CreateMercadoPagoQrOrderInput,
  MercadoPagoQrMode,
  MercadoPagoQrOrderView
} from './types';
import type { MercadoPagoQrOrder } from '@sanova/database';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeIdempotencyKey(headerValue: string | null | undefined): string {
  const trimmed = headerValue?.trim();
  if (trimmed && UUID_V4.test(trimmed)) {
    return trimmed;
  }
  return randomUUID();
}

export function shouldShowQrData(mode: MercadoPagoQrMode): boolean {
  return mode === 'dynamic' || mode === 'hybrid';
}

export function toMercadoPagoQrOrderView(record: MercadoPagoQrOrder): MercadoPagoQrOrderView {
  const qrMode = record.qrMode as MercadoPagoQrMode;
  return {
    orderId: record.id,
    mpOrderId: record.mpOrderId,
    mpPaymentId: record.mpPaymentId,
    externalReference: record.externalReference,
    amountArs: Number(record.amountArs),
    description: record.description,
    qrMode,
    status: record.status,
    statusDetail: record.statusDetail,
    qrData: record.qrData,
    showQr: shouldShowQrData(qrMode) && Boolean(record.qrData),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function validateCreateInput(input: CreateMercadoPagoQrOrderInput): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  if (!input.description?.trim()) {
    throw new Error('INVALID_DESCRIPTION');
  }
  if (!input.external_reference?.trim()) {
    throw new Error('INVALID_EXTERNAL_REFERENCE');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('INVALID_ITEMS');
  }
}

export async function createMercadoPagoQrOrderForUser(input: {
  userId: string;
  payload: CreateMercadoPagoQrOrderInput;
  idempotencyKey: string;
}): Promise<MercadoPagoQrOrderView> {
  assertMercadoPagoQrConfigured();
  validateCreateInput(input.payload);

  const existing = await findMercadoPagoQrOrderByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return toMercadoPagoQrOrderView(existing);
  }

  const externalPosId = mercadoPagoQrExternalPosId();
  if (!externalPosId) {
    throw new Error('MP_EXTERNAL_POS_ID_NOT_CONFIGURED');
  }

  const mode = input.payload.mode ?? mercadoPagoQrDefaultMode();
  const expirationTime = input.payload.expiration_time ?? mercadoPagoQrDefaultExpiration();

  const apiOrder = await createMercadoPagoQrOrderApi(
    {
      ...input.payload,
      external_pos_id: externalPosId,
      mode,
      expiration_time: expirationTime
    },
    input.idempotencyKey
  );

  const record = await upsertMercadoPagoQrOrderFromApi({
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
    externalReference: input.payload.external_reference,
    qrMode: mode,
    apiOrder
  });

  return toMercadoPagoQrOrderView(record);
}

export async function getMercadoPagoQrOrderStatusForUser(input: {
  userId: string;
  orderId: string;
}): Promise<MercadoPagoQrOrderView> {
  assertMercadoPagoQrConfigured();

  const local = await findMercadoPagoQrOrderForUser(input);
  if (!local) {
    throw new Error('ORDER_NOT_FOUND');
  }

  const apiOrder = await getMercadoPagoQrOrderApi(local.mpOrderId);
  const updated = await updateMercadoPagoQrOrderFromApi(local.id, apiOrder);
  return toMercadoPagoQrOrderView(updated);
}

export async function cancelMercadoPagoQrOrderForUser(input: {
  userId: string;
  orderId: string;
  idempotencyKey: string;
}): Promise<MercadoPagoQrOrderView> {
  assertMercadoPagoQrConfigured();

  const local = await findMercadoPagoQrOrderForUser(input);
  if (!local) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (local.status !== 'created') {
    throw new Error('ORDER_NOT_CANCELLABLE');
  }

  const apiOrder = await cancelMercadoPagoQrOrderApi(local.mpOrderId, input.idempotencyKey);
  const updated = await updateMercadoPagoQrOrderFromApi(local.id, apiOrder);
  return toMercadoPagoQrOrderView(updated);
}

export async function refundMercadoPagoQrOrderForUser(input: {
  userId: string;
  orderId: string;
  idempotencyKey: string;
  amount?: number;
}): Promise<MercadoPagoQrOrderView> {
  assertMercadoPagoQrConfigured();

  const local = await findMercadoPagoQrOrderForUser(input);
  if (!local) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('INVALID_REFUND_AMOUNT');
    }
    if (input.amount > Number(local.amountArs)) {
      throw new Error('REFUND_AMOUNT_EXCEEDS_TOTAL');
    }
  }

  const apiOrder = await refundMercadoPagoQrOrderApi(
    local.mpOrderId,
    input.idempotencyKey,
    input.amount
  );
  const updated = await updateMercadoPagoQrOrderFromApi(local.id, apiOrder);
  return toMercadoPagoQrOrderView(updated);
}

export async function syncMercadoPagoQrOrderByMpOrderId(mpOrderId: string): Promise<void> {
  const local = await prisma.mercadoPagoQrOrder.findUnique({ where: { mpOrderId } });
  if (!local) {
    return;
  }

  const apiOrder = await getMercadoPagoQrOrderApi(mpOrderId);
  await updateMercadoPagoQrOrderFromApi(local.id, apiOrder);
}

export function mapMercadoPagoQrServiceError(error: unknown): { status: number; code: string } {
  if (error instanceof Error) {
    switch (error.message) {
      case 'MP_ACCESS_TOKEN_NOT_CONFIGURED':
      case 'MP_EXTERNAL_POS_ID_NOT_CONFIGURED':
        return { status: 503, code: error.message };
      case 'INVALID_AMOUNT':
      case 'INVALID_DESCRIPTION':
      case 'INVALID_EXTERNAL_REFERENCE':
      case 'INVALID_ITEMS':
      case 'INVALID_REFUND_AMOUNT':
      case 'REFUND_AMOUNT_EXCEEDS_TOTAL':
        return { status: 400, code: error.message };
      case 'ORDER_NOT_FOUND':
        return { status: 404, code: error.message };
      case 'ORDER_NOT_CANCELLABLE':
        return { status: 409, code: error.message };
      default:
        break;
    }
  }

  if (error instanceof MercadoPagoQrApiError) {
    if (error.status === 404) {
      return { status: 404, code: 'MP_ORDER_NOT_FOUND' };
    }
    if (error.status === 409) {
      return { status: 409, code: 'MP_ORDER_CONFLICT' };
    }
    return { status: 502, code: 'MERCADOPAGO_QR_API_ERROR' };
  }

  return { status: 500, code: 'INTERNAL_ERROR' };
}
