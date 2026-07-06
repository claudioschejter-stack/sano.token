import { prisma } from '@sanova/database';

function isCampaignOpen(input: {
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
}): boolean {
  if (input.status !== 'ACTIVE') {
    return false;
  }

  const now = Date.now();

  if (input.startsAt && input.startsAt.getTime() > now) {
    return false;
  }

  if (input.endsAt && input.endsAt.getTime() < now) {
    return false;
  }

  return true;
}

function buildContactSnapshot(user: {
  email: string;
  phone: string | null;
  kycFullName: string | null;
  name: string | null;
  kycPortraitPath: string | null;
  image: string | null;
}) {
  const phone = user.phone?.trim() || null;
  const fullName = user.kycFullName?.trim() || user.name?.trim() || null;
  const portraitPath = user.kycPortraitPath?.trim() || null;

  return { phone, fullName, portraitPath, email: user.email };
}

function assertCompleteContactSnapshot(snapshot: ReturnType<typeof buildContactSnapshot>): void {
  if (!snapshot.phone) {
    throw new Error('CONTACT_PHONE_REQUIRED');
  }

  if (!snapshot.fullName) {
    throw new Error('CONTACT_NAME_REQUIRED');
  }

  if (!snapshot.portraitPath) {
    throw new Error('CONTACT_PORTRAIT_REQUIRED');
  }
}

export async function enterPrizeCampaign(input: {
  userId: string;
  campaignId: string;
}): Promise<{ entryId: string }> {
  const [campaign, user] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: input.campaignId } }),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        investorId: true,
        kycStatus: true,
        kycFullName: true,
        name: true,
        kycPortraitPath: true,
        image: true
      }
    })
  ]);

  if (!campaign) {
    throw new Error('CAMPAIGN_NOT_FOUND');
  }

  if (!isCampaignOpen(campaign)) {
    throw new Error('CAMPAIGN_NOT_ACTIVE');
  }

  if (!user || user.kycStatus !== 'APPROVED') {
    throw new Error('KYC_REQUIRED');
  }

  const snapshot = buildContactSnapshot(user);
  assertCompleteContactSnapshot(snapshot);

  const latestVerification = await prisma.kycVerification.findFirst({
    where: { userId: input.userId, status: 'APPROVED' },
    orderBy: { approvedAt: 'desc' }
  });

  const entry = await prisma.prizeEntry.upsert({
    where: {
      campaignId_userId: {
        campaignId: input.campaignId,
        userId: input.userId
      }
    },
    create: {
      campaignId: input.campaignId,
      userId: input.userId,
      investorId: user.investorId,
      kycVerificationId: latestVerification?.id ?? null,
      email: snapshot.email,
      phone: snapshot.phone,
      fullName: snapshot.fullName,
      portraitPath: snapshot.portraitPath
    },
    update: {
      investorId: user.investorId,
      kycVerificationId: latestVerification?.id ?? null,
      email: snapshot.email,
      phone: snapshot.phone,
      fullName: snapshot.fullName,
      portraitPath: snapshot.portraitPath
    }
  });

  return { entryId: entry.id };
}

export async function listActiveCampaigns() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });

  return campaigns.filter((campaign) => isCampaignOpen(campaign));
}
