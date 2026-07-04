import { prisma } from '@sanova/database';
import type { MercadoPagoPixPaymentApiResponse } from './types';

export async function findMercadoPagoPixPaymentByIdempotencyKey(idempotencyKey: string) {
  return prisma.mercadoPagoPixPayment.findUnique({ where: { idempotencyKey } });
}

export async function findMercadoPagoPixPaymentForUser(input: { userId: string; paymentId: string }) {
  return prisma.mercadoPagoPixPayment.findFirst({
    where: {
      userId: input.userId,
      OR: [{ id: input.paymentId }, { mpPaymentId: input.paymentId }]
    }
  });
}

export async function findMercadoPagoPixPaymentByMpPaymentId(mpPaymentId: string) {
  return prisma.mercadoPagoPixPayment.findUnique({ where: { mpPaymentId } });
}

export async function upsertMercadoPagoPixPaymentFromApi(input: {
  userId: string;
  idempotencyKey: string;
  externalReference: string;
  apiPayment: MercadoPagoPixPaymentApiResponse;
}) {
  const mpPaymentId = input.apiPayment.id !== undefined ? String(input.apiPayment.id) : null;
  if (!mpPaymentId) {
    throw new Error('MP_PIX_PAYMENT_ID_MISSING');
  }

  const amountBrl = Number(input.apiPayment.transaction_amount ?? 0);
  const transactionData = input.apiPayment.point_of_interaction?.transaction_data;
  const expiresAt = input.apiPayment.date_of_expiration ? new Date(input.apiPayment.date_of_expiration) : null;

  return prisma.mercadoPagoPixPayment.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      userId: input.userId,
      mpPaymentId,
      externalReference: input.externalReference,
      amountBrl,
      description: input.apiPayment.description ?? null,
      status: input.apiPayment.status ?? 'pending',
      statusDetail: input.apiPayment.status_detail ?? null,
      qrCode: transactionData?.qr_code ?? null,
      qrCodeBase64: transactionData?.qr_code_base64 ?? null,
      expiresAt,
      idempotencyKey: input.idempotencyKey,
      metadata: input.apiPayment as object
    },
    update: {
      status: input.apiPayment.status ?? 'pending',
      statusDetail: input.apiPayment.status_detail ?? null,
      qrCode: transactionData?.qr_code ?? undefined,
      qrCodeBase64: transactionData?.qr_code_base64 ?? undefined,
      metadata: input.apiPayment as object
    }
  });
}

export async function updateMercadoPagoPixPaymentFromApi(
  localId: string,
  apiPayment: MercadoPagoPixPaymentApiResponse
) {
  return prisma.mercadoPagoPixPayment.update({
    where: { id: localId },
    data: {
      status: apiPayment.status ?? undefined,
      statusDetail: apiPayment.status_detail ?? null,
      metadata: apiPayment as object
    }
  });
}
