import type { AdminAssetRecord } from './assetsService';
import { EMPTY_CENTRIFUGE_CHECKLIST, type CentrifugeChecklist } from './launchTypes';
import {
  evaluateCollateralReadiness,
  evaluateRequirement,
  getProtocolDefinition,
  type CollateralProjectContext,
  type CollateralRequirementId
} from '../collateral/collateralRegistry';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { readTreasuryVaultReadiness } from '../blockchain/verifyTreasuryVaultShares';
import type { LaunchGateIssue, LaunchGateIssueCode } from './erc4626LaunchGate';

const MORPHO_FORM_REQUIREMENTS: CollateralRequirementId[] = [
  'minSupplyMet',
  'trustContractUploaded',
  'legalAuditDone',
  'navOracleConfigured',
  'kycPolicyActive',
  'liquidityPlanDocumented',
  'jurisdictionSet',
  'spvDocumented'
];

const REQUIREMENT_TO_ISSUE: Partial<Record<CollateralRequirementId, LaunchGateIssueCode>> = {
  minSupplyMet: 'MORPHO_MIN_SUPPLY',
  trustContractUploaded: 'MISSING_TRUST_CONTRACT',
  legalAuditDone: 'MORPHO_LEGAL_AUDIT',
  navOracleConfigured: 'MISSING_NAV_ORACLE',
  kycPolicyActive: 'MORPHO_KYC_POLICY',
  liquidityPlanDocumented: 'MORPHO_LIQUIDITY_PLAN',
  jurisdictionSet: 'MISSING_JURISDICTION',
  spvDocumented: 'MISSING_SPV',
  tokenDeployed: 'TOKEN_NOT_DEPLOYED',
  erc4626Vault: 'VAULT_NOT_DEPLOYED',
  smartContractVerified: 'SMART_CONTRACT_NOT_LINKED',
  chainSupported: 'MORPHO_CHAIN_UNSUPPORTED'
};

export type Erc4626MorphoFormInput = {
  totalTokens?: number;
  spvEntityName?: string | null;
  navOracleUrl?: string | null;
  jurisdiction?: string | null;
  contracts?: { trust?: string | null };
  centrifugeChecklist?: CentrifugeChecklist;
  collateralMorpho?: boolean;
  chainId?: number | null;
};

function toMorphoProjectContext(
  input: Erc4626MorphoFormInput,
  existing?: AdminAssetRecord | null
): CollateralProjectContext {
  const chainId = input.chainId ?? existing?.chainId ?? resolveMorphoChainId();

  return {
    id: existing?.id ?? 'draft',
    title: existing?.title ?? '',
    tokenName: existing?.tokenName ?? null,
    tokenSymbol: existing?.tokenSymbol ?? null,
    tokenStandard: existing?.tokenStandard ?? 'ERC4626',
    tokenInstrumentType: existing?.tokenInstrumentType ?? 'EQUITY',
    maturityDate: existing?.maturityDate ?? null,
    tokenDeployStatus: existing?.tokenDeployStatus ?? 'NOT_REQUESTED',
    contractAddress: existing?.contractAddress ?? null,
    vaultAddress: existing?.vaultAddress ?? null,
    chainId,
    totalTokens: input.totalTokens ?? existing?.totalTokens ?? 0,
    pricePerToken: existing?.pricePerToken ?? 0,
    spvEntityName: input.spvEntityName ?? existing?.spvEntityName ?? null,
    navOracleUrl: input.navOracleUrl ?? existing?.navOracleUrl ?? null,
    jurisdiction: input.jurisdiction ?? existing?.jurisdiction ?? null,
    centrifugeChecklist: input.centrifugeChecklist ?? existing?.centrifugeChecklist ?? {
      ...EMPTY_CENTRIFUGE_CHECKLIST
    },
    contracts: {
      trust: input.contracts?.trust ?? existing?.contracts.trust ?? null,
      purchase: existing?.contracts.purchase ?? null,
      lease: existing?.contracts.lease ?? null
    },
    collateralTargets: existing?.collateralTargets ?? []
  };
}

function issueFromRequirement(id: CollateralRequirementId, detail?: string): LaunchGateIssue {
  const code = REQUIREMENT_TO_ISSUE[id] ?? 'MORPHO_COLLATERAL_NOT_READY';
  return { code, detail: detail ?? id };
}

export function validateErc4626MorphoFormRequirements(
  input: Erc4626MorphoFormInput,
  existing?: AdminAssetRecord | null
): LaunchGateIssue[] {
  const issues: LaunchGateIssue[] = [];

  if (input.collateralMorpho === false) {
    issues.push({ code: 'MORPHO_NOT_SELECTED' });
    return issues;
  }

  const project = toMorphoProjectContext(input, existing);
  const def = getProtocolDefinition('MORPHO');

  for (const reqId of MORPHO_FORM_REQUIREMENTS) {
    if (!evaluateRequirement(reqId, project, def)) {
      issues.push(issueFromRequirement(reqId));
    }
  }

  if (!evaluateRequirement('chainSupported', project, def)) {
    issues.push(issueFromRequirement('chainSupported', String(project.chainId ?? 'unknown')));
  }

  return issues;
}

export function getMorphoPostDeployIssues(asset: AdminAssetRecord): LaunchGateIssue[] {
  const issues: LaunchGateIssue[] = [];
  const morpho = asset.collateralTargets.find((target) => target.protocol === 'MORPHO');

  if (!morpho) {
    issues.push({ code: 'MORPHO_NOT_SELECTED' });
    return issues;
  }

  if (morpho.status !== 'REGISTERED') {
    issues.push({
      code: 'MORPHO_MARKET_NOT_REGISTERED',
      detail: morpho.lastError ?? morpho.status
    });
  }

  if (!morpho.oracleAddress?.trim()) {
    issues.push({ code: 'MORPHO_ORACLE_MISSING' });
  }

  const readiness = evaluateCollateralReadiness(
    {
      id: asset.id,
      title: asset.title,
      tokenName: asset.tokenName,
      tokenSymbol: asset.tokenSymbol,
      tokenStandard: asset.tokenStandard,
      tokenInstrumentType: asset.tokenInstrumentType,
      maturityDate: asset.maturityDate,
      tokenDeployStatus: asset.tokenDeployStatus,
      contractAddress: asset.contractAddress,
      vaultAddress: asset.vaultAddress,
      chainId: asset.chainId,
      totalTokens: asset.totalTokens,
      pricePerToken: asset.pricePerToken,
      spvEntityName: asset.spvEntityName,
      navOracleUrl: asset.navOracleUrl,
      jurisdiction: asset.jurisdiction,
      centrifugeChecklist: asset.centrifugeChecklist,
      contracts: asset.contracts,
      collateralTargets: asset.collateralTargets
    },
    'MORPHO'
  );

  for (const missing of readiness.missing) {
    const mapped = REQUIREMENT_TO_ISSUE[missing];
    if (mapped) {
      issues.push({ code: mapped, detail: missing });
    }
  }

  return issues;
}

export async function getTreasuryReadinessIssues(asset: AdminAssetRecord): Promise<LaunchGateIssue[]> {
  const issues: LaunchGateIssue[] = [];
  const { treasury, hasShares, kycApproved } = await readTreasuryVaultReadiness(asset);

  if (!treasury) {
    issues.push({ code: 'TREASURY_NOT_CONFIGURED' });
    return issues;
  }

  if (!hasShares) {
    issues.push({ code: 'TREASURY_VAULT_SHARES_MISSING', detail: treasury });
  }

  if (!kycApproved) {
    issues.push({ code: 'TREASURY_KYC_NOT_APPROVED', detail: treasury });
  }

  return issues;
}
