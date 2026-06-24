import { prisma } from '@sanova/database';
import { setInvestorKycAllowlist } from './kycAllowlist';
import { isRwaOperatorConfigured } from './rwaOperatorSigner';
import { isPendingInvestorWallet } from '../investor/provisionInvestorProfile';

/**
 * Automatically whitelists an investor's wallet on all active on-chain token contracts
 * after their KYC is approved. Called from:
 *  - Didit KYC webhook (APPROVED status) when a wallet is already linked
 *  - Investor wallet link API (POST/PATCH) when KYC is already APPROVED
 *
 * Non-blocking: logs errors but never throws — does not affect the caller's response.
 */
export async function autoAllowlistInvestorWallet(userId: string): Promise<void> {
  try {
    if (!isRwaOperatorConfigured()) {
      console.warn('[autoAllowlist] RWA operator not configured — skipping on-chain whitelist');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        walletAddress: true,
        investor: {
          select: { walletAddress: true }
        }
      }
    });

    if (!user || user.kycStatus !== 'APPROVED') {
      return;
    }

    const candidates = [
      user.walletAddress?.trim(),
      user.investor?.walletAddress?.trim()
    ];

    const walletAddress = candidates.find(
      (addr) => addr && addr.length > 10 && !isPendingInvestorWallet(addr)
    );

    if (!walletAddress) {
      console.info('[autoAllowlist] No real wallet linked yet for userId', userId);
      return;
    }

    const projects = await prisma.project.findMany({
      where: { contractAddress: { not: null }, isActive: true },
      select: { id: true, title: true, contractAddress: true }
    });

    if (!projects.length) {
      console.info('[autoAllowlist] No active token contracts to whitelist on');
      return;
    }

    const results: Array<{ project: string; success: boolean; txHash?: string; error?: string }> = [];

    for (const project of projects) {
      if (!project.contractAddress) continue;
      try {
        const result = await setInvestorKycAllowlist({
          tokenAddress: project.contractAddress,
          walletAddress,
          approved: true
        });
        results.push({ project: project.title, success: true, txHash: result.txHash });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ project: project.title, success: false, error: message });
        console.error(`[autoAllowlist] Failed on ${project.title} (${project.contractAddress}):`, message);
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.info(
      `[autoAllowlist] Whitelist complete for ${walletAddress}: ${succeeded} succeeded, ${failed} failed`
    );
  } catch (err) {
    console.error('[autoAllowlist] Unexpected error for userId', userId, err);
  }
}
