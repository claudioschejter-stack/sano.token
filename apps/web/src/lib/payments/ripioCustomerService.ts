import { randomUUID } from 'node:crypto';
import { prisma } from '@sanova/database';
import { ripioApi } from './ripioClient';

type RipioCustomerResponse = {
  customerId?: string;
  email?: string;
  isActive?: boolean;
};

export async function resolveRipioCustomerId(input: {
  userId: string;
  email: string;
}): Promise<string> {
  const prior = await prisma.platformDeposit.findFirst({
    where: {
      userId: input.userId,
      provider: 'ripio'
    },
    orderBy: { createdAt: 'desc' }
  });

  const priorMeta = (prior?.metadata as { ripioCustomerId?: string } | null) ?? null;
  if (priorMeta?.ripioCustomerId?.trim()) {
    return priorMeta.ripioCustomerId.trim();
  }

  const customerId = randomUUID();
  await ripioApi<RipioCustomerResponse>('/api/v1/customers/', {
    method: 'POST',
    body: {
      customerId,
      email: input.email,
      type: 'INDIVIDUAL'
    }
  });

  return customerId;
}
