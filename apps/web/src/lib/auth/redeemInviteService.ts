import { prisma } from '@sanova/database';
import { isInvestorOpenRegistration, resolveInvestorAccessOnRegister } from './investorAccess';
import { isPreApprovedInvestorEmail } from './roleAllowlist';

export async function redeemInvestorInviteCode(userId: string, email: string, inviteCode: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const code = inviteCode.trim();

  if (!code) {
    throw new Error('INVALID_INVITE_CODE');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true, investorAccessEnabled: true }
  });

  if (!user || user.systemRole !== 'INVESTOR') {
    throw new Error('NOT_INVESTOR');
  }

  if (user.investorAccessEnabled) {
    return { enabled: true };
  }

  const enabled =
    isInvestorOpenRegistration() ||
    isPreApprovedInvestorEmail(normalizedEmail) ||
    resolveInvestorAccessOnRegister(code);

  if (!enabled) {
    throw new Error('INVALID_INVITE_CODE');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { investorAccessEnabled: true }
  });

  return { enabled: true };
}
