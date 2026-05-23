import { prisma, type KycStatus } from '@sanova/database';
import type { AdvisorContext } from './advisorContext';
import { getScopedAdvisorIds } from './advisorContext';

export type AdvisorClientRecord = {
  id: string;
  email: string;
  name: string | null;
  kycStatus: KycStatus;
  walletAddress: string | null;
  jurisdiction: string | null;
  createdAt: string;
  incorporatedAt: string | null;
  incorporatedByEmail: string | null;
  investor: {
    id: string;
    fullName: string;
    cuit: string;
    investorType: string;
    kycStatus: KycStatus;
    totalCapital: number;
    walletAddress: string;
  } | null;
};

export type ClientListFilter = KycStatus | 'ALL';

export async function listAdvisorClients(
  ctx: AdvisorContext,
  filter: ClientListFilter = 'ALL'
): Promise<AdvisorClientRecord[]> {
  const advisorIds = await getScopedAdvisorIds(ctx);

  const users = await prisma.user.findMany({
    where: {
      systemRole: 'INVESTOR',
      investor: {
        incorporatedByAdvisorId: { in: advisorIds }
      },
      ...(filter === 'ALL' ? {} : { kycStatus: filter })
    },
    include: {
      investor: {
        include: {
          incorporatedBy: { include: { user: { select: { email: true } } } }
        }
      }
    },
    orderBy: [{ kycStatus: 'asc' }, { createdAt: 'desc' }]
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    kycStatus: user.kycStatus,
    walletAddress: user.walletAddress,
    jurisdiction: user.jurisdiction,
    createdAt: user.createdAt.toISOString(),
    incorporatedAt: user.investor?.incorporatedAt?.toISOString() ?? null,
    incorporatedByEmail: user.investor?.incorporatedBy?.user.email ?? null,
    investor: user.investor
      ? {
          id: user.investor.id,
          fullName: user.investor.fullName,
          cuit: user.investor.cuit,
          investorType: user.investor.investorType,
          kycStatus: user.investor.kycStatus,
          totalCapital: Number(user.investor.totalCapital),
          walletAddress: user.investor.walletAddress
        }
      : null
  }));
}
