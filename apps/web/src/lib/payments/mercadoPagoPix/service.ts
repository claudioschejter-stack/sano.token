import { randomUUID } from 'node:crypto';
import type { MercadoPagoPixPayment } from '@sanova/database';
import { createMercadoPagoPixPaymentApi, getMercadoPagoPixPaymentApi, MercadoPagoPixApiError } from './client';
import { assertMercadoPagoPixConfigured, mercadoPagoPixDefaultExpirationMinutes } from './config';
import {
  findMercadoPagoPixPaymentByIdempotencyKey,
  findMercadoPagoPixPaymentForUser,
  updateMercadoPagoPixPaymentFromApi,
  upsertMercadoPagoPixPaymentFromApi
} from './repository';
import type { CreateMercadoPagoPixPaymentInput, MercadoPagoPixPaymentView } from './types';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizePixIdempotencyKey(headerValue: string | null | undefined): string {
  const trimmed = headerValue?.trim();
  if (trimmed && UUID_V4.test(trimmed)) {
    return trimmed;
  }
  return randomUUID();
}

export function toMercadoPagoPixPaymentView(record: MercadoPagoPixPayment): MercadoPagoPixPaymentView {
  return {
    paymentId: record.id,
    mpPaymentId: record.mpPaymentId,
    externalReference: record.externalReference,
    amountBrl: Number(record.amountBrl),
    description: record.description,
    status: record.status,
    statusDetail: record.statusDetail,
    qrCode: record.qrCode,
    qrCodeBase64: record.qrCodeBase64,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function validateCreateInput(input: CreateMercadoPagoPixPaymentInput): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  if (!input.description?.trim()) {
    throw new Error('INVALID_DESCRIPTION');
  }
  if (!input.external_reference?.trim()) {
    throw new Error('INVALID_EXTERNAL_REFERENCE');
  }
}

export async function createMercadoPagoPixPaymentForUser(input: {
  userId: string;
  payload: CreateMercadoPagoPixPaymentInput;
  idempotencyKey: string;
}): Promise<MercadoPagoPixPaymentView> {
  assertMercadoPagoPixConfigured();
  validateCreateInput(input.payload);

  const existing = await findMercadoPagoPixPaymentByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return toMercadoPagoPixPaymentView(existing);
  }

  const apiPayment = await createMercadoPagoPixPaymentApi(
    { ...input.payload, expirationMinutes: mercadoPagoPixDefaultExpirationMinutes() },
    input.idempotencyKey
  );

  const record = await upsertMercadoPagoPixPaymentFromApi({
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
    externalReference: input.payload.external_reference,
    apiPayment
  });

  return toMercadoPagoPixPaymentView(record);
}

export async function getMercadoPagoPixPaymentStatusForUser(input: {
  userId: string;
  paymentId: string;
}): Promise<MercadoPagoPixPaymentView> {
  assertMercadoPagoPixConfigured();

  const local = await findMercadoPagoPixPaymentForUser(input);
  if (!local) {
    throw new Error('PIX_PAYMENT_NOT_FOUND');
  }

  const apiPayment = await getMercadoPagoPixPaymentApi(local.mpPaymentId);
  const updated = await updateMercadoPagoPixPaymentFromApi(local.id, apiPayment);
  return toMercadoPagoPixPaymentView(updated);
}

export function mapMercadoPagoPixServiceError(error: unknown): { status: number; code: string } {
  if (error instanceof Error) {
    switch (error.message) {
      case 'MERCADOPAGO_BR_NOT_CONFIGURED':
        return { status: 503, code: error.message };
      case 'INVALID_AMOUNT':
      case 'INVALID_DESCRIPTION':
      case 'INVALID_EXTERNAL_REFERENCE':
        return { status: 400, code: error.message };
      case 'PIX_PAYMENT_NOT_FOUND':
        return { status: 404, code: error.message };
      default:
        break;
    }
  }

  if (error instanceof MercadoPagoPixApiError) {
    if (error.status === 404) {
      return { status: 404, code: 'MP_PIX_PAYMENT_NOT_FOUND' };
    }
    return { status: 502, code: 'MERCADOPAGO_PIX_API_ERROR' };
  }

  return { status: 500, code: 'INTERNAL_ERROR' };
}
