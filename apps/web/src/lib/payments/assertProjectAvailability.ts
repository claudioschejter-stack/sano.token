import { prisma } from '@sanova/database';

export type AvailabilityShortfall = {
  projectId: string;
  projectTitle: string;
  requestedTokens: number;
  availableTokens: number;
};

/**
 * Tokens already reserved by this batch are not counted as missing supply —
 * `availableTokens` was decremented when the intent was created.
 */
export async function findAvailabilityShortfalls(
  intents: Array<{ projectId: string; tokenCount: number; metadata: unknown }>
): Promise<AvailabilityShortfall[]> {
  const needByProject = new Map<string, number>();
  for (const intent of intents) {
    const metadata = (intent.metadata as Record<string, unknown>) ?? {};
    if (metadata.supplyReserved === true) continue;
    needByProject.set(
      intent.projectId,
      (needByProject.get(intent.projectId) ?? 0) + intent.tokenCount
    );
  }

  if (needByProject.size === 0) return [];

  const projects = await prisma.project.findMany({
    where: { id: { in: [...needByProject.keys()] } },
    select: { id: true, title: true, availableTokens: true }
  });

  const shortfalls: AvailabilityShortfall[] = [];
  for (const project of projects) {
    const requested = needByProject.get(project.id) ?? 0;
    if (project.availableTokens < requested) {
      shortfalls.push({
        projectId: project.id,
        projectTitle: project.title,
        requestedTokens: requested,
        availableTokens: project.availableTokens
      });
    }
  }

  return shortfalls;
}
