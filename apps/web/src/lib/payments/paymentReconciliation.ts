import { prisma } from '@sanova/database';
import { notifyAutomationIssue } from '../admin/automationAlerts';
import { expirePaymentIntent } from './paymentService';

export async function reconcilePayments(limit = 50) {
  const stale = await prisma.paymentIntent.findMany({
    where: {
      status: 'REQUIRES_PAYMENT',
      expiresAt: { lte: new Date() }
    },
    take: limit,
    orderBy: { expiresAt: 'asc' }
  });

  const expired = [];
  for (const intent of stale) {
    const updated = await expirePaymentIntent(intent.id);
    expired.push({ id: intent.id, status: updated?.status ?? 'UNKNOWN' });
  }

  const suspicious = await prisma.paymentIntent.findMany({
    where: {
      status: 'CONFIRMED',
      investmentId: null
    },
    take: limit
  });

  for (const intent of suspicious) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: 'MANUAL_REVIEW',
        metadata: {
          ...((intent.metadata as Record<string, unknown>) ?? {}),
          reconciliation: { reason: 'CONFIRMED_WITHOUT_INVESTMENT' }
        }
      }
    });
    await notifyAutomationIssue({
      projectId: intent.projectId,
      title: `Pago en revisión (${intent.id})`,
      message: 'La reconciliación detectó un pago confirmado sin inversión asociada.'
    });
  }

  return { expired, suspicious: suspicious.map((intent) => intent.id) };
}
