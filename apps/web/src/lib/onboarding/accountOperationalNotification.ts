import { prisma } from '@sanova/database';
import { isAccountOperational } from './accountStatus';
import { requiresInvestorStyleOnboarding } from './onboardingGate';

/**
 * Sends the "your account has been approved" email (with a CTA to the
 * platform) + an in-app notification, but ONLY once ALL of the following
 * are true:
 *   - KYC approved + wallet linked + security/TOTP set up (`isAccountOperational`)
 *   - The Sanova app is installed on the user's phone (`pwaInstalledAt`)
 *
 * Self-contained and idempotent (guarded by `accountApprovedEmailSentAt`) so
 * it's safe to call from multiple places whenever either condition could
 * have just become true: `syncUserAccountStatus` (KYC/wallet/TOTP changes)
 * and the PWA-install preference endpoint.
 */
export async function maybeSendAccountApprovedEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      kycStatus: true,
      accountStatus: true,
      walletAddress: true,
      systemRole: true,
      totpEnabled: true,
      pwaInstalledAt: true,
      accountApprovedEmailSentAt: true
    }
  });

  if (!user || user.accountApprovedEmailSentAt) {
    return;
  }

  if (!requiresInvestorStyleOnboarding(user.systemRole)) {
    return;
  }

  if (!isAccountOperational(user) || !user.pwaInstalledAt) {
    return;
  }

  // Conditional update acts as a claim/lock: if two triggers race (e.g. TOTP
  // confirm + PWA install landing at nearly the same time), only one of them
  // gets count === 1 and actually sends the notifications.
  const claimed = await prisma.user.updateMany({
    where: { id: userId, accountApprovedEmailSentAt: null },
    data: { accountApprovedEmailSentAt: new Date() }
  });

  if (claimed.count === 0) {
    return;
  }

  try {
    const { notifyInvestorAccountOperational } = await import('../investor/investorNotificationService');
    await notifyInvestorAccountOperational(userId);
  } catch (error) {
    console.error('[maybeSendAccountApprovedEmail] email failed', error);
  }

  try {
    const { createNotification } = await import('../notifications/notificationService');
    await createNotification({
      userId,
      type: 'kyc_approved',
      title: '¡Tu cuenta fue aprobada!',
      body: 'Ya podés invertir en el marketplace de Sanova Capital.',
      link: '/dashboard'
    });
  } catch (error) {
    console.error('[maybeSendAccountApprovedEmail] in-app notification failed', error);
  }
}
