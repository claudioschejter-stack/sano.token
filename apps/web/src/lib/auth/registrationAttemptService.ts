import { prisma } from '@sanova/database';
import { normalizeEmail } from './contactValidation';

// 'desktop' kept only for backward-compatibility with rows written before
// mobile-web detection existed; new writes use 'desktop-web' | 'mobile-web' | 'pwa'.
export type RegistrationChannel = 'desktop' | 'desktop-web' | 'mobile-web' | 'pwa' | 'unknown';

export async function recordRegistrationAttempt(input: {
  email: string;
  success: boolean;
  errorCode?: string;
  channel?: RegistrationChannel;
  ipCountry?: string | null;
}): Promise<void> {
  const normalized = normalizeEmail(input.email) ?? input.email.trim().toLowerCase();
  if (!normalized) {
    return;
  }

  try {
    await prisma.registrationAttempt.create({
      data: {
        email: normalized,
        success: input.success,
        errorCode: input.errorCode ?? null,
        channel: input.channel ?? 'unknown',
        ipCountry: input.ipCountry?.trim() || null
      }
    });
  } catch (error) {
    console.error('[registrationAttempt] failed to persist attempt', {
      email: normalized,
      success: input.success,
      errorCode: input.errorCode,
      error
    });
  }
}

export async function listRegistrationAttempts(options: {
  query?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const query = options.query?.trim().toLowerCase();

  return prisma.registrationAttempt.findMany({
    where: query
      ? {
          email: {
            contains: query,
            mode: 'insensitive'
          }
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}
