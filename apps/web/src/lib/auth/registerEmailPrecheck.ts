import { prisma } from '@sanova/database';
import { hasValidInvestorInviteForEmail } from '../admin/investorInviteService';
import { isPreApprovedInvestorEmail } from './roleAllowlist';

export type RegisterEmailPrecheckReason =
  | 'EMAIL_IN_USE'
  | 'INVESTOR_ACCESS_NOT_ENABLED'
  | 'OAUTH_ONLY_DISABLED';

export type RegisterEmailPrecheckResult =
  | { available: true }
  | { available: false; reason: RegisterEmailPrecheckReason };

async function hasExplicitInvestorAccessGrant(email: string): Promise<boolean> {
  return isPreApprovedInvestorEmail(email) || (await hasValidInvestorInviteForEmail(email));
}

export async function evaluateRegisterEmailPrecheck(
  email: string
): Promise<RegisterEmailPrecheckResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      passwordHash: true,
      oauthProvider: true,
      investorAccessEnabled: true,
      systemRole: true
    }
  });

  if (!user) {
    return { available: true };
  }

  const explicitAccessGrant = await hasExplicitInvestorAccessGrant(email);

  if (
    user.systemRole === 'INVESTOR' &&
    !user.investorAccessEnabled &&
    !explicitAccessGrant
  ) {
    if (user.oauthProvider && !user.passwordHash) {
      return { available: false, reason: 'OAUTH_ONLY_DISABLED' };
    }

    return { available: false, reason: 'INVESTOR_ACCESS_NOT_ENABLED' };
  }

  if (user.passwordHash || user.oauthProvider) {
    return { available: false, reason: 'EMAIL_IN_USE' };
  }

  return { available: true };
}
