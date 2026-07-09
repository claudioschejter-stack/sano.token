import { prisma } from '@sanova/database';
import { isAccountOperational } from './accountStatus';
import { requiresInvestorStyleOnboarding } from './onboardingGate';

/**
 * Sends the "your account has been approved" email (with a CTA to the
 * platform) + an in-app notification as soon as the account is fully
 * operational: KYC approved + contact verified + embedded wallet ready
 * (`isAccountOperational`). Installing the Sanova app/PWA is a separate,
 * purely optional nudge shown elsewhere — it never gates this email.
 *
 * Self-contained and idempotent (guarded by `accountApprovedEmailSentAt`) so
 * it's safe to call from multiple places whenever KYC or the wallet could
 * have just become ready: `syncUserAccountStatus` and the Privy wallet
 * pre-generation hook in `provisionInvestorProfileOnKycApproval`.
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
      accountApprovedEmailSentAt: true
    }
  });

  if (!user || user.accountApprovedEmailSentAt) {
    return;
  }

  if (!requiresInvestorStyleOnboarding(user.systemRole)) {
    return;
  }

  if (!isAccountOperational(user)) {
    return;
  }

  // Conditional update acts as a claim/lock: if two triggers race (e.g. the
  // KYC webhook and an admin re-sync landing at nearly the same time), only
  // one of them gets count === 1 and actually sends the notifications.
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
