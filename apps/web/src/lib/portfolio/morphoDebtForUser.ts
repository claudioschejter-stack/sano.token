import { prisma } from '@sanova/database';
import { readMorphoOnChainDebtUsd } from './onChainMorphoDebtReader';

export async function resolveMorphoDebtForUser(userId: string): Promise<number> {
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

  const walletAddress = user?.investor?.walletAddress;
  const projects =
    user?.investor?.investments.map((investment) => ({
      vaultAddress: investment.project.vaultAddress,
      collateralTargets: investment.project.collateralTargets
    })) ?? [];

  return readMorphoOnChainDebtUsd({ walletAddress, projects });
}
