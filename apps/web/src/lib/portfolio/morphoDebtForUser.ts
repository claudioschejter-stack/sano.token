import { prisma } from '@sanova/database';
import {
  readMorphoBorrowPositions,
  readMorphoOnChainDebtUsd,
  type MorphoBorrowPosition
} from './onChainMorphoDebtReader';

async function loadMorphoDebtProjects(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      investor: {
        select: {
          walletAddress: true,
          investments: {
            where: { status: 'ACTIVE' },
            select: {
              project: {
                select: {
                  id: true,
                  title: true,
                  vaultAddress: true,
                  collateralTargets: true
                }
              }
            }
          }
        }
      }
    }
  });

  return {
    walletAddress: user?.investor?.walletAddress,
    projects:
      user?.investor?.investments.map((investment) => ({
        projectId: investment.project.id,
        projectTitle: investment.project.title,
        vaultAddress: investment.project.vaultAddress,
        collateralTargets: investment.project.collateralTargets
      })) ?? []
  };
}

export async function resolveMorphoDebtForUser(userId: string): Promise<number> {
  const { walletAddress, projects } = await loadMorphoDebtProjects(userId);
  return readMorphoOnChainDebtUsd({ walletAddress, projects });
}

export async function resolveMorphoDebtPositionsForUser(userId: string): Promise<MorphoBorrowPosition[]> {
  const { walletAddress, projects } = await loadMorphoDebtProjects(userId);
  return readMorphoBorrowPositions({ walletAddress, projects });
}
