import { prisma } from '@sanova/database';
import type { AdvisorContext } from './advisorContext';
import { collectDownlineAdvisorIds } from './advisorContext';

export type DownlineAdvisorRecord = {
  advisorId: string;
  email: string;
  name: string | null;
  category: string;
  uplineEmail: string | null;
  downlineCount: number;
  clientCount: number;
  createdAt: string;
};

export async function listAdvisorDownline(ctx: AdvisorContext): Promise<DownlineAdvisorRecord[]> {
  if (ctx.role !== 'ADVISOR_MANAGER') {
    return [];
  }

  const scopedIds = await collectDownlineAdvisorIds(ctx.advisorId);
  const downlineIds = scopedIds.filter((id) => id !== ctx.advisorId);

  if (downlineIds.length === 0) {
    return [];
  }

  const advisors = await prisma.advisor.findMany({
    where: { id: { in: downlineIds } },
    include: {
      user: { select: { email: true, name: true } },
      upline: { include: { user: { select: { email: true } } } },
      _count: { select: { downline: true, incorporatedInvestors: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return advisors.map((row) => ({
    advisorId: row.id,
    email: row.user.email,
    name: row.user.name,
    category: row.category,
    uplineEmail: row.upline?.user.email ?? null,
    downlineCount: row._count.downline,
    clientCount: row._count.incorporatedInvestors,
    createdAt: row.createdAt.toISOString()
  }));
}
