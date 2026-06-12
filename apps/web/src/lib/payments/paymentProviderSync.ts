import type { Prisma } from '@sanova/database';
import { prisma } from '@sanova/database';
import { confirmCartBatchByProvider } from './cartCheckoutService';
import {
  confirmPaymentIntent,
  expirePaymentIntent,
  getPaymentIntentForUser,
  markPaymentIntentFailed,
  serializePaymentIntent,
  type PublicPaymentIntent
} from './paymentService';

type StripeSession = {
  id?: string;
  status?: string;
  payment_status?: string;
};

async function fetchStripeCheckoutSession(sessionId: string): Promise<StripeSession> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error('STRIPE_NOT_CONFIGURED');
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('STRIPE_SESSION_LOOKUP_FAILED');
  }

  return (await response.json()) as StripeSession;
}

function stripeSessionPaid(session: StripeSession): boolean {
  return session.payment_status === 'paid' || session.status === 'complete';
}

function stripeSessionFailed(session: StripeSession): boolean {
  return session.status === 'expired';
}

async function syncStripePaymentIntent(input: {
  paymentIntentId: string;
  providerPaymentId: string;
  payload?: Prisma.InputJsonValue;
}) {
  const session = await fetchStripeCheckoutSession(input.providerPaymentId);

  if (stripeSessionPaid(session)) {
    return confirmPaymentIntent({
      paymentIntentId: input.paymentIntentId,
      provider: 'stripe',
      providerPaymentId: input.providerPaymentId,
      payload: { source: 'client_sync', ...(typeof input.payload === 'object' ? input.payload : {}) }
    });
  }

  if (stripeSessionFailed(session)) {
    return markPaymentIntentFailed({
      paymentIntentId: input.paymentIntentId,
      provider: 'stripe',
      providerPaymentId: input.providerPaymentId,
      payload: { source: 'client_sync', sessionStatus: session.status ?? null }
    });
  }

  return null;
}

export async function syncPaymentIntentFromProvider(input: {
  userId: string;
  paymentIntentId: string;
}): Promise<PublicPaymentIntent | null> {
  const current = await getPaymentIntentForUser(input.userId, input.paymentIntentId);
  if (!current) {
    return null;
  }

  if (current.status === 'CONFIRMED') {
    return current;
  }

  const providerPaymentId = current.providerPaymentId?.trim();
  if (!providerPaymentId) {
    await expirePaymentIntent(input.paymentIntentId);
    return getPaymentIntentForUser(input.userId, input.paymentIntentId);
  }

  const provider = (current.provider ?? current.method).toLowerCase();

  if (provider.includes('stripe') || current.method === 'STRIPE') {
    const synced = await syncStripePaymentIntent({
      paymentIntentId: input.paymentIntentId,
      providerPaymentId
    });
    if (synced) {
      return synced;
    }
  }

  await expirePaymentIntent(input.paymentIntentId);
  return getPaymentIntentForUser(input.userId, input.paymentIntentId);
}

export async function syncCartBatchFromProvider(input: { userId: string; batchId: string }) {
  const intents = await prisma.paymentIntent.findMany({
    where: { userId: input.userId },
    orderBy: { createdAt: 'asc' }
  });

  const batchIntents = intents.filter((row) => {
    const metadata = (row.metadata as Record<string, unknown>) ?? {};
    return metadata.cartBatchId === input.batchId;
  });

  if (!batchIntents.length) {
    return [];
  }

  if (batchIntents.every((row) => row.status === 'CONFIRMED')) {
    return batchIntents.map(serializePaymentIntent);
  }

  const primary = batchIntents[0];
  const providerPaymentId = primary.providerPaymentId?.trim();
  if (!providerPaymentId) {
    return batchIntents.map(serializePaymentIntent);
  }

  const provider = (primary.provider ?? primary.method).toLowerCase();
  if (provider.includes('stripe') || primary.method === 'STRIPE') {
    const session = await fetchStripeCheckoutSession(providerPaymentId);
    if (stripeSessionPaid(session)) {
      return confirmCartBatchByProvider({
        batchId: input.batchId,
        provider: 'stripe',
        providerPaymentId,
        payload: { source: 'client_sync' }
      });
    }
    if (stripeSessionFailed(session)) {
      const { markCartBatchPaymentFailed } = await import('./cartCheckoutService');
      await markCartBatchPaymentFailed({
        batchId: input.batchId,
        paymentIntentId: primary.id,
        provider: 'stripe',
        providerPaymentId,
        payload: { source: 'client_sync', sessionStatus: session.status ?? null }
      });
    }
  }

  return batchIntents.map(serializePaymentIntent);
}
