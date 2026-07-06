import { prisma } from '@sanova/database';
import { persistDiditMedia } from './diditMedia';

/**
 * Legacy wrapper kept for callers that only have the webhook/decision payload.
 * Prefer `persistDiditMedia` when the KycVerification id is known.
 */
export async function storeDiditProfilePhoto(
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const verification = await prisma.kycVerification.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    if (!verification) {
      return;
    }

    await persistDiditMedia({
      userId,
      kycVerificationId: verification.id,
      payload
    });
  } catch (error) {
    console.error('[diditPhoto] unexpected error', error instanceof Error ? error.message : error);
  }
}
