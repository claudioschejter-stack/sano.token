import { isAddress } from 'ethers';
import { prisma } from '@sanova/database';
import { isPendingInvestorWallet } from './provisionInvestorProfile';

/**
 * Start the on-chain KYC timelock as soon as an investor is approved.
 *
 * `SanovaAssetToken.setKyc` waits out a 24 hour delay after the action is
 * scheduled. Scheduling at checkout meant an investor who had just been
 * approved sat in front of a blocked purchase for a day; scheduling here lets
 * the delay run during onboarding, so by the time they buy, the approval is
 * already available.
 *
 * Best effort by design: it must never block KYC approval. What it does not
 * finish, the allowlist check at checkout still handles.
 */
export async function scheduleInvestorKycOnChain(input: {
  userId: string;
  walletAddress?: string | null;
}): Promise<{ scheduled: number; skipped: string | null }> {
  const wallet = input.walletAddress?.trim();

  // A deterministic placeholder is not an address anything can be approved on.
  if (!wallet || !isAddress(wallet) || isPendingInvestorWallet(wallet)) {
    return { scheduled: 0, skipped: 'WALLET_NOT_LINKED' };
  }

  const projects = await prisma.project.findMany({
    where: { contractAddress: { not: null }, isActive: true },
    select: { id: true, contractAddress: true }
  });
  if (!projects.length) {
    return { scheduled: 0, skipped: 'NO_TOKENIZED_PROJECTS' };
  }

  const { JsonRpcProvider } = await import('ethers');
  const { scheduleTokenKyc } = await import('../blockchain/scheduleTokenKyc');
  const rpc = new JsonRpcProvider(
    process.env.BASE_RPC_URL?.trim() ||
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
  );

  let scheduled = 0;
  try {
    for (const project of projects) {
      const result = await scheduleTokenKyc({
        provider: rpc,
        tokenAddress: project.contractAddress!,
        investorAddress: wallet
      }).catch(() => null);

      if (result?.ok) {
        scheduled += 1;
      }
    }
  } finally {
    rpc.destroy();
  }

  return { scheduled, skipped: null };
}
