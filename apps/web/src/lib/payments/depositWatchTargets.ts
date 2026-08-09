import { prisma } from '@sanova/database';
import { isPendingInvestorWallet } from '../investor/provisionInvestorProfile';
import { getStablecoinNetwork } from './stablecoinNetworks';

/**
 * Every address whose inbound USDC the platform has to act on.
 *
 * The investors' wallets, plus the treasury: money arriving there is a fiat
 * payment completing its second half, and hearing about it turns a confirmation
 * that waited for a cron into one that happens in seconds.
 *
 * Lives here rather than in the admin route because the scheduled sync needs the
 * same list, and Alchemy never reports which addresses it is already watching —
 * so the only safe strategy is to re-declare the full list, which means one
 * definition of what "the full list" is.
 */
export async function depositWatchTargets(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { walletAddress: { not: null } },
    select: { walletAddress: true }
  });

  const treasury = getStablecoinNetwork('BASE').treasuryAddress?.trim();

  return [
    ...new Set(
      [...users.map((row) => row.walletAddress?.trim()), treasury].filter(
        (row): row is string => Boolean(row) && !isPendingInvestorWallet(row!)
      )
    )
  ];
}
