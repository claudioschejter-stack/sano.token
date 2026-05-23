import { prisma } from '@sanova/database';
import type { SystemRole } from '../auth/roles';

export type AdvisorContext = {
  userId: string;
  role: SystemRole;
  advisorId: string;
};

export async function getAdvisorContextForUser(
  userId: string,
  role: SystemRole
): Promise<AdvisorContext | null> {
  if (role !== 'ADVISOR' && role !== 'ADVISOR_MANAGER') {
    return null;
  }

  const advisor = await prisma.advisor.findUnique({
    where: { userId },
    select: { id: true }
  });

  if (!advisor) {
    return null;
  }

  return { userId, role, advisorId: advisor.id };
}

export async function collectDownlineAdvisorIds(rootAdvisorId: string): Promise<string[]> {
  const collected = new Set<string>([rootAdvisorId]);
  let frontier = [rootAdvisorId];

  while (frontier.length > 0) {
    const children = await prisma.advisor.findMany({
      where: { uplineId: { in: frontier } },
      select: { id: true }
    });

    frontier = [];
    for (const child of children) {
      if (!collected.has(child.id)) {
        collected.add(child.id);
        frontier.push(child.id);
      }
    }
  }

  return [...collected];
}

export async function getScopedAdvisorIds(ctx: AdvisorContext): Promise<string[]> {
  if (ctx.role === 'ADVISOR') {
    return [ctx.advisorId];
  }

  return collectDownlineAdvisorIds(ctx.advisorId);
}
