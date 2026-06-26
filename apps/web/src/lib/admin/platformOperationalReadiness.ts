import { Contract, JsonRpcProvider, isAddress } from 'ethers';
import { listAdminAssets, type AdminAssetRecord } from './assetsService';
import { inferEmissionProfileFromAsset } from './emissionProfiles';
import { getErc4626OnChainIssues, isErc4626OnChainReady } from './erc4626LaunchGate';
import { getMorphoPostDeployIssues, getTreasuryReadinessIssues } from './erc4626MorphoGate';
import { readTreasuryVaultReadiness } from '../blockchain/verifyTreasuryVaultShares';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import {
  isTreasuryOwnerSignerConfigured,
  resolveTreasuryOwnerAddress,
  resolveTreasuryOwnerSigner
} from '../blockchain/treasuryOwnerSigner';
import {
  isMorphoLiquiditySignerConfigured,
  resolveMorphoLiquidityAddress,
  resolveMorphoLiquiditySigner
} from '../blockchain/morphoLiquiditySigner';
import { resolveMorphoSeedUsdcForProject } from '../lending/morphoSeedLiquidity';
import { getLendingChainConfig } from '../lending/baseContracts';

export type OpsCheckStatus = 'OK' | 'WARN' | 'FAIL';

export type OpsCheck = {
  id: string;
  label: string;
  status: OpsCheckStatus;
  detail?: string;
};

export type ProjectOpsReport = {
  projectId: string;
  title: string;
  emissionProfile: string;
  isActive: boolean;
  readyToBorrow: boolean;
  checks: OpsCheck[];
  issues: string[];
  repairRecommended: boolean;
};

export type PlatformOpsReport = {
  generatedAt: string;
  platformChecks: OpsCheck[];
  projects: ProjectOpsReport[];
  summary: {
    platformReady: boolean;
    projectsTotal: number;
    projectsReady: number;
    projectsNeedingRepair: number;
  };
};

function resolveBaseRpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

function isBaseMorpho4626Asset(asset: AdminAssetRecord): boolean {
  return inferEmissionProfileFromAsset(asset) === 'BASE_MORPHO_4626';
}

export async function validateTreasurySignerOnChain(): Promise<OpsCheck[]> {
  const checks: OpsCheck[] = [];
  const treasury = resolveTreasuryAddress();
  const signerAddress = resolveTreasuryOwnerAddress();
  const usesPrivy = Boolean(process.env.PRIVY_SAFE_OWNER_WALLET_ID?.trim());

  if (!isTreasuryOwnerSignerConfigured()) {
    checks.push({
      id: 'treasury_signer_key',
      label: usesPrivy ? 'PRIVY_SAFE_OWNER_WALLET_ID' : 'TREASURY_OWNER_PRIVATE_KEY',
      status: 'FAIL',
      detail: 'No configurada'
    });
    return checks;
  }

  checks.push({
    id: 'treasury_signer_key',
    label: usesPrivy ? 'PRIVY_SAFE_OWNER_WALLET_ID' : 'TREASURY_OWNER_PRIVATE_KEY',
    status: 'OK',
    detail: usesPrivy
      ? `${process.env.PRIVY_SAFE_OWNER_WALLET_ID} → ${signerAddress ?? 'TREASURY_OWNER_ADDRESS?'}`
      : 'Configurada'
  });

  if (!treasury || !isAddress(treasury)) {
    checks.push({
      id: 'token_treasury_address',
      label: 'TOKEN_TREASURY_ADDRESS',
      status: 'FAIL',
      detail: 'No configurada o inválida'
    });
    return checks;
  }

  checks.push({
    id: 'token_treasury_address',
    label: 'TOKEN_TREASURY_ADDRESS',
    status: 'OK',
    detail: treasury
  });

  const provider = new JsonRpcProvider(resolveBaseRpcUrl());
  const chainId = getLendingChainConfig().chainId;
  const wallet = signerAddress ? await resolveTreasuryOwnerSigner(provider, chainId) : null;

  if (!wallet || !signerAddress) {
    checks.push({
      id: 'treasury_signer_match',
      label: 'Signer treasury',
      status: 'FAIL',
      detail: 'No se pudo resolver el firmante treasury'
    });
    return checks;
  }

  try {
    const code = await provider.getCode(treasury);
    const isSafe = code !== '0x';

    if (!isSafe) {
      const match = signerAddress.toLowerCase() === treasury.toLowerCase();
      checks.push({
        id: 'treasury_signer_match',
        label: 'Signer vs treasury (EOA)',
        status: match ? 'OK' : 'FAIL',
        detail: match
          ? `Coincide (${signerAddress})`
          : `Signer ${signerAddress} ≠ treasury ${treasury}`
      });
      return checks;
    }

    const safe = new Contract(
      treasury,
      ['function getOwners() view returns (address[])'],
      provider
    );
    const owners: string[] = await safe.getOwners();
    const isOwner = owners.some((owner) => owner.toLowerCase() === signerAddress.toLowerCase());
    checks.push({
      id: 'treasury_signer_match',
      label: 'Signer es owner del Safe treasury',
      status: isOwner ? 'OK' : 'FAIL',
      detail: isOwner
        ? `${signerAddress} es owner del Safe`
        : `Signer ${signerAddress} no es owner del Safe ${treasury}. Agregalo en app.safe.global.`
    });
  } catch (error) {
    checks.push({
      id: 'treasury_signer_match',
      label: 'Validación on-chain treasury signer',
      status: 'WARN',
      detail: error instanceof Error ? error.message : 'RPC error'
    });
  } finally {
    provider.destroy();
  }

  return checks;
}

export async function validateMorphoSeedWallet(): Promise<OpsCheck[]> {
  const checks: OpsCheck[] = [];
  const usesPrivy = Boolean(process.env.PRIVY_MORPHO_LIQUIDITY_WALLET_ID?.trim());
  const liquidityAddress = resolveMorphoLiquidityAddress();

  if (!isMorphoLiquiditySignerConfigured()) {
    checks.push({
      id: 'morpho_liquidity_signer',
      label: usesPrivy ? 'PRIVY_MORPHO_LIQUIDITY_WALLET_ID' : 'TOKEN_DEPLOY_PRIVATE_KEY',
      status: 'FAIL',
      detail: 'No configurada (requerida para seed Morpho)'
    });
    return checks;
  }

  checks.push({
    id: 'morpho_liquidity_signer',
    label: usesPrivy ? 'PRIVY_MORPHO_LIQUIDITY_WALLET_ID' : 'TOKEN_DEPLOY_PRIVATE_KEY',
    status: 'OK',
    detail: usesPrivy
      ? `${process.env.PRIVY_MORPHO_LIQUIDITY_WALLET_ID} → ${liquidityAddress ?? 'MORPHO_LIQUIDITY_ADDRESS?'}`
      : liquidityAddress ?? 'Configurada'
  });

  const seedFloor = Number(process.env.MORPHO_SEED_LIQUIDITY_USDC ?? '0');
  checks.push({
    id: 'morpho_seed_floor',
    label: 'MORPHO_SEED_LIQUIDITY_USDC',
    status: Number.isFinite(seedFloor) && seedFloor > 0 ? 'OK' : 'WARN',
    detail: Number.isFinite(seedFloor) && seedFloor > 0 ? `${seedFloor} USDC mínimo` : 'No definido'
  });

  const provider = new JsonRpcProvider(resolveBaseRpcUrl());
  const chainId = getLendingChainConfig().chainId;
  const signer = liquidityAddress ? await resolveMorphoLiquiditySigner(provider, chainId) : null;

  if (!signer || !liquidityAddress) {
    checks.push({
      id: 'morpho_liquidity_usdc',
      label: 'USDC en wallet Morpho liquidity',
      status: 'FAIL',
      detail: 'No se pudo resolver la wallet de liquidez Morpho'
    });
    provider.destroy();
    return checks;
  }

  try {
    const { usdc } = getLendingChainConfig();
    const usdcContract = new Contract(
      usdc,
      [
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ],
      signer
    );
    const [balance, decimals] = await Promise.all([
      usdcContract.balanceOf(liquidityAddress),
      usdcContract.decimals()
    ]);
    const balanceUsd = Number(balance) / 10 ** Number(decimals);
    const minRequired = Number.isFinite(seedFloor) && seedFloor > 0 ? seedFloor : 100;

    checks.push({
      id: 'morpho_seed_wallet_usdc',
      label: 'USDC en wallet Morpho liquidity',
      status: balanceUsd >= minRequired ? 'OK' : 'WARN',
      detail: `${balanceUsd.toFixed(2)} USDC en ${liquidityAddress} (mínimo recomendado ${minRequired})`
    });
  } catch (error) {
    checks.push({
      id: 'morpho_seed_wallet_usdc',
      label: 'USDC en wallet Morpho liquidity',
      status: 'WARN',
      detail: error instanceof Error ? error.message : 'No se pudo leer balance USDC'
    });
  } finally {
    provider.destroy();
  }

  return checks;
}

async function auditBaseMorphoProject(asset: AdminAssetRecord): Promise<ProjectOpsReport> {
  const checks: OpsCheck[] = [];
  const issues: string[] = [];

  const onChainIssues = getErc4626OnChainIssues(asset);
  for (const issue of onChainIssues) {
    issues.push(issue.code + (issue.detail ? `: ${issue.detail}` : ''));
  }

  checks.push({
    id: 'token_deployed',
    label: 'Token desplegado',
    status: asset.contractAddress ? 'OK' : 'FAIL',
    detail: asset.contractAddress ?? asset.tokenDeployStatus
  });

  checks.push({
    id: 'vault_deployed',
    label: 'Vault ERC-4626 desplegado',
    status: asset.vaultAddress ? 'OK' : 'FAIL',
    detail: asset.vaultAddress ?? 'missing'
  });

  const morphoIssues = getMorphoPostDeployIssues(asset);
  for (const issue of morphoIssues) {
    issues.push(issue.code + (issue.detail ? `: ${issue.detail}` : ''));
  }

  const morpho = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  checks.push({
    id: 'morpho_registered',
    label: 'Morpho market registrado',
    status: morpho?.status === 'REGISTERED' && morpho.oracleAddress ? 'OK' : 'FAIL',
    detail: morpho ? `${morpho.status}${morpho.oracleAddress ? '' : ' (sin oracle)'}` : 'MORPHO missing'
  });

  const treasuryIssues = await getTreasuryReadinessIssues(asset);
  for (const issue of treasuryIssues) {
    issues.push(issue.code + (issue.detail ? `: ${issue.detail}` : ''));
  }

  const treasuryReadiness = await readTreasuryVaultReadiness(asset);
  checks.push({
    id: 'treasury_vault_shares',
    label: 'Treasury con vault shares',
    status: treasuryReadiness.hasShares ? 'OK' : 'FAIL',
    detail: treasuryReadiness.treasury ?? 'treasury not configured'
  });

  checks.push({
    id: 'treasury_kyc',
    label: 'Treasury KYC aprobado',
    status: treasuryReadiness.kycApproved ? 'OK' : 'FAIL',
    detail: treasuryReadiness.treasury ?? undefined
  });

  const seedTarget = resolveMorphoSeedUsdcForProject({
    totalTokens: asset.totalTokens,
    pricePerToken: asset.pricePerToken
  });
  checks.push({
    id: 'morpho_seed_target',
    label: 'Objetivo seed Morpho USDC',
    status: seedTarget > 0 ? 'OK' : 'WARN',
    detail: `${seedTarget} USDC`
  });

  checks.push({
    id: 'morpho_liquidity',
    label: 'Liquidez Morpho',
    status:
      asset.morphoLiquidityStatus === 'LIQUID'
        ? 'OK'
        : asset.morphoLiquidityStatus === 'NO_LIQUIDITY'
          ? 'FAIL'
          : 'WARN',
    detail: asset.morphoLiquidityStatus ?? 'unknown'
  });

  checks.push({
    id: 'ready_to_borrow',
    label: 'Listo para borrow',
    status: asset.readyToBorrow ? 'OK' : 'WARN',
    detail: asset.readyToBorrow ? 'yes' : 'no'
  });

  const hasFail = checks.some((check) => check.status === 'FAIL') || issues.length > 0;
  const onChainReady = isErc4626OnChainReady(asset);

  return {
    projectId: asset.id,
    title: asset.title,
    emissionProfile: 'BASE_MORPHO_4626',
    isActive: asset.isActive,
    readyToBorrow: asset.readyToBorrow,
    checks,
    issues,
    repairRecommended: hasFail || !onChainReady || !asset.readyToBorrow
  };
}

export async function auditPlatformOperationalReadiness(): Promise<PlatformOpsReport> {
  const platformChecks = [
    ...(await validateTreasurySignerOnChain()),
    ...(await validateMorphoSeedWallet())
  ];

  const assets = await listAdminAssets('ALL');
  const baseMorphoAssets = assets.filter(isBaseMorpho4626Asset);
  const projects = await Promise.all(baseMorphoAssets.map((asset) => auditBaseMorphoProject(asset)));

  const projectsReady = projects.filter(
    (project) => !project.repairRecommended && project.checks.every((check) => check.status !== 'FAIL')
  ).length;

  const platformReady =
    platformChecks.every((check) => check.status !== 'FAIL') &&
    projects.length > 0 &&
    projectsReady === projects.length;

  return {
    generatedAt: new Date().toISOString(),
    platformChecks,
    projects,
    summary: {
      platformReady,
      projectsTotal: projects.length,
      projectsReady,
      projectsNeedingRepair: projects.length - projectsReady
    }
  };
}

export async function repairProjectTreasuryAndMorpho(projectId: string) {
  const { clearAutomationFailures, getAdminAsset, appendDeploymentEvent } = await import('./assetsService');
  await clearAutomationFailures(projectId);

  let asset = await getAdminAsset(projectId);
  if (!asset) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  const { repairTreasuryVaultShares } = await import('../blockchain/repairTreasuryVaultShares');
  const treasuryRepair = await repairTreasuryVaultShares(asset);
  await appendDeploymentEvent(projectId, {
    step: 'VAULT_FUNDING',
    status: treasuryRepair.ok ? 'SUCCESS' : 'FAILED',
    message: treasuryRepair.message,
    txHash: treasuryRepair.txHash ?? null
  });

  if (asset.contractAddress && asset.vaultAddress) {
    const { registerProjectCollateral } = await import('../collateral/collateralOrchestrator');
    await registerProjectCollateral(projectId, ['MORPHO'], { skipLock: true });
  }

  asset = (await getAdminAsset(projectId)) ?? asset;
  const morpho = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');
  let morphoLiquidity = null;
  if (morpho?.status === 'REGISTERED' && asset.vaultAddress) {
    const { checkMorphoLiquidity } = await import('../lending/morphoLiquidityCheck');
    morphoLiquidity = await checkMorphoLiquidity(asset);
  }

  return { projectId, treasuryRepair, morphoLiquidity, asset: await getAdminAsset(projectId) };
}

export async function repairBaseMorphoProjects(input?: { projectIds?: string[]; dryRun?: boolean }) {
  const report = await auditPlatformOperationalReadiness();
  const targetIds =
    input?.projectIds?.length ?
      input.projectIds
    : report.projects.filter((project) => project.repairRecommended).map((project) => project.projectId);

  if (input?.dryRun) {
    return { dryRun: true as const, targetIds, report };
  }

  const results: Array<{
    projectId: string;
    ok: boolean;
    treasuryOk?: boolean;
    morphoStatus?: string;
    error?: string;
  }> = [];

  for (const projectId of targetIds) {
    try {
      const repair = await repairProjectTreasuryAndMorpho(projectId);
      results.push({
        projectId,
        ok: repair.treasuryRepair.ok,
        treasuryOk: repair.treasuryRepair.ok,
        morphoStatus: repair.morphoLiquidity?.status
      });
    } catch (error) {
      results.push({
        projectId,
        ok: false,
        error: error instanceof Error ? error.message : 'repair failed'
      });
    }
  }

  const after = await auditPlatformOperationalReadiness();
  return { targetIds, results, before: report.summary, after: after.summary, report: after };
}
