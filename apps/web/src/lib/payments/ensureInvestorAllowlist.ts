import { prisma } from '@sanova/database';
import { Contract, JsonRpcProvider } from 'ethers';
import SanovaAssetTokenArtifact from '../blockchain/artifacts/SanovaAssetToken.json';
import { baseRpcUrls } from './stablecoinNetworks';

export type AllowlistGap = {
  projectId: string;
  projectTitle: string;
  walletAddress: string;
  /** Row present and approved in `investorAllowlist`. */
  dbApproved: boolean;
  /** `kycApproved(wallet)` on the project asset token. */
  onChainApproved: boolean | null;
};

async function readOnChainKyc(input: {
  tokenAddress: string;
  walletAddress: string;
}): Promise<boolean | null> {
  for (const url of baseRpcUrls()) {
    const provider = new JsonRpcProvider(url, 8453, { staticNetwork: true });
    try {
      const token = new Contract(input.tokenAddress, SanovaAssetTokenArtifact.abi, provider);
      const approved = Boolean(await token.kycApproved(input.walletAddress));
      provider.destroy();
      return approved;
    } catch {
      provider.destroy();
    }
  }
  return null;
}

/**
 * Which tokenized projects would refuse to credit this wallet.
 *
 * The purchase gate runs at confirm time, so without this pre-check an investor
 * could pay USDC and only then hit `ALLOWLIST_NOT_APPROVED`.
 */
export async function findAllowlistGaps(input: {
  walletAddress: string;
  projectIds: string[];
}): Promise<AllowlistGap[]> {
  const wallet = input.walletAddress.trim().toLowerCase();
  if (!wallet || input.projectIds.length === 0) return [];

  const projects = await prisma.project.findMany({
    where: { id: { in: input.projectIds } },
    select: { id: true, title: true, contractAddress: true, vaultAddress: true }
  });

  const rows = await prisma.investorAllowlist.findMany({
    where: { walletAddress: wallet, projectId: { in: input.projectIds } },
    select: { projectId: true, approved: true }
  });
  const approvedByProject = new Map(rows.map((row) => [row.projectId, row.approved]));

  const gaps: AllowlistGap[] = [];
  for (const project of projects) {
    const requiresAllowlist = Boolean(project.contractAddress?.trim() || project.vaultAddress?.trim());
    if (!requiresAllowlist) continue;

    const dbApproved = approvedByProject.get(project.id) === true;
    const onChainApproved = project.contractAddress?.trim()
      ? await readOnChainKyc({
          tokenAddress: project.contractAddress.trim(),
          walletAddress: wallet
        })
      : null;

    // `null` means the chain could not be read — do not block on that alone.
    if (dbApproved && onChainApproved !== false) continue;

    gaps.push({
      projectId: project.id,
      projectTitle: project.title,
      walletAddress: wallet,
      dbApproved,
      onChainApproved
    });
  }

  return gaps;
}

export type AllowlistAttempt = {
  projectId: string;
  projectTitle: string;
  ok: boolean;
  txHash?: string | null;
  error?: string;
};

export type EnsureAllowlistResult = {
  attempted: boolean;
  remainingGaps: AllowlistGap[];
  /** Per-project outcome — `autoAllowlistInvestorWallet` swallows failures. */
  attempts?: AllowlistAttempt[];
};

/**
 * Whitelist a wallet on each project's asset token and mirror it in the DB,
 * reporting why any project failed instead of logging and moving on.
 */
export async function allowlistInvestorWalletWithReport(input: {
  userId: string;
  walletAddress: string;
  projectIds: string[];
}): Promise<AllowlistAttempt[]> {
  const { isRwaOperatorConfigured } = await import('../blockchain/rwaOperatorSigner');
  const projects = await prisma.project.findMany({
    where: { id: { in: input.projectIds } },
    select: { id: true, title: true, contractAddress: true }
  });

  if (!isRwaOperatorConfigured()) {
    return projects.map((project) => ({
      projectId: project.id,
      projectTitle: project.title,
      ok: false,
      error:
        'RWA_OPERATOR_NOT_CONFIGURED: set PRIVY_OPERATOR_WALLET_ID + RWA_OPERATOR_ADDRESS (+ PRIVY_APP_SECRET) in Vercel.'
    }));
  }

  const { setInvestorKycAllowlist } = await import('../blockchain/kycAllowlist');
  const { upsertInvestorAllowlist } = await import('../admin/investorsService');

  const attempts: AllowlistAttempt[] = [];
  for (const project of projects) {
    if (!project.contractAddress?.trim()) {
      attempts.push({
        projectId: project.id,
        projectTitle: project.title,
        ok: false,
        error: 'PROJECT_TOKEN_NOT_DEPLOYED'
      });
      continue;
    }

    try {
      const result = await setInvestorKycAllowlist({
        tokenAddress: project.contractAddress.trim(),
        walletAddress: input.walletAddress,
        approved: true
      });
      await upsertInvestorAllowlist({
        userId: input.userId,
        projectId: project.id,
        walletAddress: input.walletAddress,
        approved: true,
        txHash: result.txHash ?? null
      });
      attempts.push({
        projectId: project.id,
        projectTitle: project.title,
        ok: true,
        txHash: result.txHash ?? null
      });
    } catch (error) {
      attempts.push({
        projectId: project.id,
        projectTitle: project.title,
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 300) : 'ALLOWLIST_FAILED'
      });
    }
  }

  return attempts;
}

/**
 * Try to close allowlist gaps before charging: KYC-approved investors should be
 * whitelisted automatically, on-chain and in the DB.
 */
export async function ensureInvestorAllowlistForProjects(input: {
  userId: string;
  walletAddress: string;
  projectIds: string[];
}): Promise<EnsureAllowlistResult> {
  const gaps = await findAllowlistGaps({
    walletAddress: input.walletAddress,
    projectIds: input.projectIds
  });
  if (gaps.length === 0) {
    return { attempted: false, remainingGaps: [] };
  }

  const attempts = await allowlistInvestorWalletWithReport({
    userId: input.userId,
    walletAddress: input.walletAddress,
    projectIds: gaps.map((gap) => gap.projectId)
  });

  const remainingGaps = await findAllowlistGaps({
    walletAddress: input.walletAddress,
    projectIds: input.projectIds
  });

  return { attempted: true, remainingGaps, attempts };
}
