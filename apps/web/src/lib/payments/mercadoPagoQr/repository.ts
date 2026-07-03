import { prisma } from '@sanova/database';
import type { MercadoPagoQrMode, MercadoPagoQrOrderApiResponse } from './types';

function parseExpiration(isoDuration: string | undefined, createdAt: Date): Date | null {
  if (!isoDuration) {
    return null;
  }

  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(isoDuration);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  if (ms <= 0) {
    return null;
  }

  return new Date(createdAt.getTime() + ms);
}

export function extractMpPaymentId(order: MercadoPagoQrOrderApiResponse): string | null {
  const paymentId = order.transactions?.payments?.[0]?.id;
  return paymentId ? String(paymentId) : null;
}

export async function findMercadoPagoQrOrderByIdempotencyKey(idempotencyKey: string) {
  return prisma.mercadoPagoQrOrder.findUnique({ where: { idempotencyKey } });
}

export async function findMercadoPagoQrOrderForUser(input: {
  userId: string;
  orderId: string;
}) {
  return prisma.mercadoPagoQrOrder.findFirst({
    where: {
      userId: input.userId,
      OR: [{ id: input.orderId }, { mpOrderId: input.orderId }]
    }
  });
}

export async function upsertMercadoPagoQrOrderFromApi(input: {
  userId: string;
  idempotencyKey: string;
  externalReference: string;
  qrMode: MercadoPagoQrMode;
  apiOrder: MercadoPagoQrOrderApiResponse;
}) {
  const mpOrderId = input.apiOrder.id;
  if (!mpOrderId) {
    throw new Error('MP_ORDER_ID_MISSING');
  }

  const createdAt = input.apiOrder.created_date
    ? new Date(input.apiOrder.created_date)
    : new Date();
  const expiresAt = parseExpiration(input.apiOrder.expiration_time, createdAt);
  const amountArs = Number(input.apiOrder.total_amount ?? 0);
  const qrData = input.apiOrder.type_response?.qr_data ?? null;

  return prisma.mercadoPagoQrOrder.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      userId: input.userId,
      mpOrderId,
      mpPaymentId: extractMpPaymentId(input.apiOrder),
      externalReference: input.externalReference,
      amountArs,
      description: input.apiOrder.description ?? null,
      qrMode: input.qrMode,
      status: input.apiOrder.status ?? 'created',
      statusDetail: input.apiOrder.status_detail ?? null,
      qrData,
      expiresAt,
      idempotencyKey: input.idempotencyKey,
      metadata: input.apiOrder as object
    },
    update: {
      mpPaymentId: extractMpPaymentId(input.apiOrder),
      status: input.apiOrder.status ?? 'created',
      statusDetail: input.apiOrder.status_detail ?? null,
      qrData,
      expiresAt,
      metadata: input.apiOrder as object
    }
  });
}

export async function updateMercadoPagoQrOrderFromApi(
  localId: string,
  apiOrder: MercadoPagoQrOrderApiResponse
) {
  return prisma.mercadoPagoQrOrder.update({
    where: { id: localId },
    data: {
      mpPaymentId: extractMpPaymentId(apiOrder),
      status: apiOrder.status ?? undefined,
      statusDetail: apiOrder.status_detail ?? null,
      qrData: apiOrder.type_response?.qr_data ?? undefined,
      metadata: apiOrder as object
    }
  });
}
