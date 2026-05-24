import { prisma } from '@sanova/database';

export type AdminStats = {
  totalUsers: number;
  investorUsers: number;
  kycPendingUsers: number;
  activeProjects: number;
  totalInvestors: number;
  activeInvestments: number;
  staffUsers: number;
  totalCapitalUsd: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const [
    totalUsers,
    investorUsers,
    kycPendingUsers,
    activeProjects,
    totalInvestors,
    activeInvestments,
    staffUsers,
    capitalAgg
  ] = await Promise.all([
    prisma.user.count({
      where: {
        OR: [
          { systemRole: { not: 'INVESTOR' } },
          { systemRole: 'INVESTOR', emailVerifiedAt: { not: null }, phone: { not: null } }
        ]
      }
    }),
    prisma.user.count({
      where: { systemRole: 'INVESTOR', emailVerifiedAt: { not: null }, phone: { not: null } }
    }),
    prisma.user.count({
      where: {
        kycStatus: 'PENDING',
        systemRole: 'INVESTOR',
        emailVerifiedAt: { not: null },
        phone: { not: null }
      }
    }),
    prisma.project.count({ where: { isActive: true } }),
    prisma.investor.count(),
    prisma.investment.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { systemRole: { not: 'INVESTOR' } } }),
    prisma.investor.aggregate({ _sum: { totalCapital: true } })
  ]);

  return {
    totalUsers,
    investorUsers,
    kycPendingUsers,
    activeProjects,
    totalInvestors,
    activeInvestments,
    staffUsers,
    totalCapitalUsd: Number(capitalAgg._sum.totalCapital ?? 0)
  };
}
