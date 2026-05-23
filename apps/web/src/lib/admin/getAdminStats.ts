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
    prisma.user.count(),
    prisma.user.count({ where: { systemRole: 'INVESTOR' } }),
    prisma.user.count({ where: { kycStatus: 'PENDING', systemRole: 'INVESTOR' } }),
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
