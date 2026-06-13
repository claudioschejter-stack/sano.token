import type { AdminAssetRecord } from '../admin/assetsService';
import type { CollateralProtocol, TokenStandard } from '../admin/launchTypes';
import { isVaultTokenStandard } from '../admin/vaultStandards';
import { BASE_MAINNET_CHAIN_ID } from '../blockchain/supportedChains';

export type CollateralRequirementId =
  | 'tokenDeployed'
  | 'kycTokenStandard'
  | 'erc4626Vault'
  | 'spvDocumented'
  | 'legalAuditDone'
  | 'navOracleConfigured'
  | 'kycPolicyActive'
  | 'liquidityPlanDocumented'
  | 'smartContractVerified'
  | 'trustContractUploaded'
  | 'purchaseContractUploaded'
  | 'leaseContractUploaded'
  | 'jurisdictionSet'
  | 'minSupplyMet'
  | 'chainSupported'
  | 'promoterEntitySet'
  | 'debtInstrumentType'
  | 'maturityDateSet';

export type CollateralRequirement = {
  id: CollateralRequirementId;
  labelKey: string;
  weight: number;
};

export type CollateralProtocolDefinition = {
  id: CollateralProtocol;
  name: string;
  category: 'money_market';
  envCredentialKeys: string[];
  docsUrl: string;
  minTokenSupply: number;
  supportedChainIds: number[];
  requiresErc4626: boolean;
  requiresSanovaToken: boolean;
  institutionalReview: boolean;
  requirements: CollateralRequirement[];
};

export type CollateralReadinessResult = {
  protocol: CollateralProtocol;
  score: number;
  requirements: Record<CollateralRequirementId, boolean>;
  missing: CollateralRequirementId[];
  ready: boolean;
};

export type CollateralProjectContext = Pick<
  AdminAssetRecord,
  | 'id'
  | 'title'
  | 'tokenName'
  | 'tokenSymbol'
  | 'tokenStandard'
  | 'tokenInstrumentType'
  | 'maturityDate'
  | 'tokenDeployStatus'
  | 'contractAddress'
  | 'vaultAddress'
  | 'chainId'
  | 'totalTokens'
  | 'pricePerToken'
  | 'spvEntityName'
  | 'navOracleUrl'
  | 'jurisdiction'
  | 'centrifugeChecklist'
  | 'contracts'
  | 'collateralTargets'
>;

const BASE_REQUIREMENTS: CollateralRequirement[] = [
  { id: 'tokenDeployed', labelKey: 'tokenDeployed', weight: 15 },
  { id: 'kycTokenStandard', labelKey: 'kycTokenStandard', weight: 10 },
  { id: 'spvDocumented', labelKey: 'spvDocumented', weight: 10 },
  { id: 'legalAuditDone', labelKey: 'legalAuditDone', weight: 10 },
  { id: 'navOracleConfigured', labelKey: 'navOracleConfigured', weight: 10 },
  { id: 'kycPolicyActive', labelKey: 'kycPolicyActive', weight: 8 },
  { id: 'trustContractUploaded', labelKey: 'trustContractUploaded', weight: 8 },
  { id: 'jurisdictionSet', labelKey: 'jurisdictionSet', weight: 5 },
  { id: 'minSupplyMet', labelKey: 'minSupplyMet', weight: 5 },
  { id: 'chainSupported', labelKey: 'chainSupported', weight: 5 },
  { id: 'smartContractVerified', labelKey: 'smartContractVerified', weight: 8 },
  { id: 'liquidityPlanDocumented', labelKey: 'liquidityPlanDocumented', weight: 6 }
];

export const COLLATERAL_PROTOCOLS: CollateralProtocolDefinition[] = [
  {
    id: 'MORPHO',
    name: 'Morpho',
    category: 'money_market',
    envCredentialKeys: ['MORPHO_API_KEY', 'MORPHO_CURATOR_ADDRESS'],
    docsUrl: 'https://docs.morpho.org',
    minTokenSupply: 5000,
    supportedChainIds: [BASE_MAINNET_CHAIN_ID],
    requiresErc4626: true,
    requiresSanovaToken: true,
    institutionalReview: true,
    requirements: [
      ...BASE_REQUIREMENTS,
      { id: 'erc4626Vault', labelKey: 'erc4626Vault', weight: 12 }
    ]
  }
];

export function getProtocolDefinition(protocol: CollateralProtocol): CollateralProtocolDefinition {
  const def = COLLATERAL_PROTOCOLS.find((p) => p.id === protocol);
  if (!def) {
    throw new Error(`Unknown collateral protocol: ${protocol}`);
  }
  return def;
}

function isSanovaToken(standard: TokenStandard): boolean {
  return standard === 'SANOVA_KYC' || isVaultTokenStandard(standard);
}

export function evaluateRequirement(
  id: CollateralRequirementId,
  project: CollateralProjectContext,
  def: CollateralProtocolDefinition
): boolean {
  const checklist = project.centrifugeChecklist;

  switch (id) {
    case 'tokenDeployed':
      return Boolean(project.contractAddress) && project.tokenDeployStatus === 'DEPLOYED';
    case 'kycTokenStandard':
      return isSanovaToken(project.tokenStandard);
    case 'erc4626Vault':
      return isVaultTokenStandard(project.tokenStandard) && Boolean(project.vaultAddress);
    case 'spvDocumented':
      return checklist.spvDocumented || Boolean(project.spvEntityName) || Boolean(project.contracts.trust);
    case 'legalAuditDone':
      return checklist.legalAuditDone;
    case 'navOracleConfigured':
      return checklist.navOracleConfigured || Boolean(project.navOracleUrl);
    case 'kycPolicyActive':
      return checklist.kycPolicyActive;
    case 'liquidityPlanDocumented':
      return checklist.liquidityPlanDocumented;
    case 'smartContractVerified':
      return checklist.smartContractVerified || Boolean(project.contractAddress);
    case 'trustContractUploaded':
      return Boolean(project.contracts.trust);
    case 'purchaseContractUploaded':
      return Boolean(project.contracts.purchase);
    case 'leaseContractUploaded':
      return Boolean(project.contracts.lease);
    case 'jurisdictionSet':
      return Boolean(project.jurisdiction);
    case 'minSupplyMet':
      return project.totalTokens >= def.minTokenSupply;
    case 'chainSupported':
      return project.chainId != null && def.supportedChainIds.includes(project.chainId);
    case 'promoterEntitySet':
      return Boolean(project.spvEntityName);
    case 'debtInstrumentType':
      return project.tokenInstrumentType === 'DEBT';
    case 'maturityDateSet':
      return project.tokenInstrumentType !== 'DEBT' || Boolean(project.maturityDate);
    default:
      return false;
  }
}

export function evaluateCollateralReadiness(
  project: CollateralProjectContext,
  protocol: CollateralProtocol
): CollateralReadinessResult {
  const def = getProtocolDefinition(protocol);
  const requirements: Record<string, boolean> = {};
  let earned = 0;
  let total = 0;
  const missing: CollateralRequirementId[] = [];

  for (const req of def.requirements) {
    const met = evaluateRequirement(req.id, project, def);
    requirements[req.id] = met;
    total += req.weight;
    if (met) {
      earned += req.weight;
    } else {
      missing.push(req.id);
    }
  }

  if (def.requiresSanovaToken && !isSanovaToken(project.tokenStandard)) {
    missing.push('kycTokenStandard');
  }

  if (def.requiresErc4626 && !isVaultTokenStandard(project.tokenStandard)) {
    if (!missing.includes('erc4626Vault')) {
      missing.push('erc4626Vault');
    }
  }

  const score = total > 0 ? Math.round((earned / total) * 100) : 0;

  return {
    protocol,
    score,
    requirements: requirements as Record<CollateralRequirementId, boolean>,
    missing,
    ready: missing.length === 0 && score === 100
  };
}

export function protocolCredentialsConfigured(def: CollateralProtocolDefinition): boolean {
  return def.envCredentialKeys.every((key) => Boolean(process.env[key]?.trim()));
}

export function buildCollateralSubmissionPayload(
  project: CollateralProjectContext,
  protocol: CollateralProtocol
) {
  return {
    protocol,
    projectId: project.id,
    assetTitle: project.title,
    token: {
      name: project.tokenName,
      symbol: project.tokenSymbol,
      standard: project.tokenStandard,
      vaultKind: isVaultTokenStandard(project.tokenStandard) ? project.tokenStandard : null,
      instrumentType: project.tokenInstrumentType,
      maturityDate: project.maturityDate,
      contractAddress: project.contractAddress,
      vaultAddress: project.vaultAddress,
      chainId: project.chainId,
      totalSupply: project.totalTokens
    },
    legal: {
      spvEntityName: project.spvEntityName,
      jurisdiction: project.jurisdiction,
      trustUrl: project.contracts.trust,
      purchaseUrl: project.contracts.purchase,
      leaseUrl: project.contracts.lease
    },
    oracle: {
      navOracleUrl: project.navOracleUrl
    },
    checklist: project.centrifugeChecklist,
    submittedAt: new Date().toISOString()
  };
}
