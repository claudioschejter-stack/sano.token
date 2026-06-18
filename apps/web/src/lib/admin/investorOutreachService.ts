import { prisma } from '@sanova/database';
import { isPendingInvestorWallet } from '../investor/provisionInvestorProfile';
import { resolveSiteUrl } from '../invite/resolveSiteUrl';
import { buildWhatsAppInviteUrl } from '../invite/whatsappInvite';

export type InvestorOutreachPayload = {
  userId: string;
  email: string;
  phone: string | null;
  name: string | null;
  kycStatus: string;
  actionUrl: string;
  message: string;
  whatsappUrl: string | null;
};

function buildOutreachMessage(input: {
  name: string | null;
  intro: string;
  actionUrl: string;
}): string {
  const greeting = input.name?.trim() ? `Hola ${input.name.trim()},` : 'Hola,';
  return [greeting, '', input.intro, input.actionUrl, '', 'Sanova Global'].join('\n');
}

export function buildInvestorOutreach(input: {
  email: string;
  phone: string | null;
  name: string | null;
  kycStatus: string;
  walletLinked: boolean;
}): Omit<InvestorOutreachPayload, 'userId'> {
  const siteUrl = resolveSiteUrl();
  let actionUrl: string;
  let intro: string;

  if (input.kycStatus === 'APPROVED' && input.walletLinked) {
    actionUrl = `${siteUrl}/marketplace`;
    intro = 'Tu cuenta en Sanova Global está lista. Accedé al marketplace de activos tokenizados:';
  } else if (input.kycStatus === 'APPROVED') {
    actionUrl = `${siteUrl}/onboarding?returnTo=${encodeURIComponent('/marketplace')}`;
    intro = 'Activá tu wallet en Sanova Global para empezar a invertir:';
  } else {
    const params = new URLSearchParams({
      email: input.email,
      returnTo: '/onboarding'
    });
    actionUrl = `${siteUrl}/acceso?${params.toString()}`;
    intro = 'Completá tu verificación KYC en Sanova Global para acceder como inversor:';
  }

  const message = buildOutreachMessage({
    name: input.name,
    intro,
    actionUrl
  });

  return {
    email: input.email,
    phone: input.phone,
    name: input.name,
    kycStatus: input.kycStatus,
    actionUrl,
    message,
    whatsappUrl: input.phone?.trim() ? buildWhatsAppInviteUrl(input.phone, message) : null
  };
}

export async function getInvestorOutreach(userId: string): Promise<InvestorOutreachPayload | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, systemRole: 'INVESTOR' },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      kycStatus: true,
      walletAddress: true
    }
  });

  if (!user) {
    return null;
  }

  const walletLinked = Boolean(user.walletAddress?.trim() && !isPendingInvestorWallet(user.walletAddress));
  const outreach = buildInvestorOutreach({
    email: user.email,
    phone: user.phone,
    name: user.name,
    kycStatus: user.kycStatus,
    walletLinked
  });

  return {
    userId: user.id,
    ...outreach
  };
}
