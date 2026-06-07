import type { AdminAssetRecord } from '../admin/assetsService';
import type { CollateralProtocol, TokenStandard } from '../admin/launchTypes';
import { isVaultTokenStandard } from '../admin/vaultStandards';
import { PLUME_MAINNET_CHAIN_ID, PLUME_TESTNET_CHAIN_ID } from '../blockchain/supportedChains';

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
  category: 'rwa_pool' | 'money_market' | 'credit_pool' | 'provenance';
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
    id: 'CENTRIFUGE',
    name: 'Centrifuge',
    category: 'rwa_pool',
    envCredentialKeys: ['CENTRIFUGE_API_KEY', 'CENTRIFUGE_POOL_ADMIN_URL'],
    docsUrl: 'https://docs.centrifuge.io',
    minTokenSupply: 1000,
    supportedChainIds: [1, 8453, 84532, 137, PLUME_MAINNET_CHAIN_ID, PLUME_TESTNET_CHAIN_ID],
    requiresErc4626: true,
    requiresSanovaToken: true,
    institutionalReview: true,
    requirements: [
      ...BASE_REQUIREMENTS,
      { id: 'erc4626Vault', labelKey: 'erc4626Vault', weight: 10 }
    ]
  },
  {
    id: 'SKY',
    name: 'Sky Protocol (MakerDAO)',
    category: 'money_market',
    envCredentialKeys: ['SKY_INSTITUTIONAL_CONTACT', 'CHAINLINK_ORACLE_KEY'],
    docsUrl: 'https://docs.sky.money',
    minTokenSupply: 10000,
    supportedChainIds: [1, 8453],
    requiresErc4626: false,
    requiresSanovaToken: true,
    institutionalReview: true,
    requirements: [
      ...BASE_REQUIREMENTS,
      { id: 'purchaseContractUploaded', labelKey: 'purchaseContractUploaded', weight: 8 },
      { id: 'promoterEntitySet', labelKey: 'promoterEntitySet', weight: 5 }
    ]
  },
  {
    id: 'MORPHO',
    name: 'Morpho',
    category: 'money_market',
    envCredentialKeys: ['MORPHO_API_KEY', 'MORPHO_CURATOR_ADDRESS'],
    docsUrl: 'https://docs.morpho.org',
    minTokenSupply: 5000,
    supportedChainIds: [1, 8453, 84532, 137, PLUME_MAINNET_CHAIN_ID, PLUME_TESTNET_CHAIN_ID],
    requiresErc4626: true,
    requiresSanovaToken: true,
    institutionalReview: true,
    requirements: [
      ...BASE_REQUIREMENTS,
      { id: 'erc4626Vault', labelKey: 'erc4626Vault', weight: 12 }
    ]
  },
  {
    id: 'AAVE_HORIZON',
    name: 'Aave Horizon (RWA)',
    category: 'money_market',
    envCredentialKeys: ['AAVE_HORIZON_API_KEY', 'AAVE_HORIZON_RISK_ADMIN'],
    docsUrl: 'https://aave.com/docs/developers/aave-v3',
    minTokenSupply: 5000,
    supportedChainIds: [1, 8453],
    requiresErc4626: true,
    requiresSanovaToken: true,
    institutionalReview: true,
    requirements: [
      ...BASE_REQUIREMENTS,
      { id: 'erc4626Vault', labelKey: 'erc4626Vault', weight: 10 },
      { id: 'leaseContractUploaded', labelKey: 'leaseContractUploaded', weight: 6 }
    ]
  },
  {
    id: 'MAPLE',
    name: 'Maple Finance',
    category: 'credit_pool',
    envCredentialKeys: ['MAPLE_API_KEY', 'MAPLE_POOL_DELEGATE'],
    docsUrl: 'https://docs.maple.finance',
    minTokenSupply: 25000,
    supportedChainIds: [1, 8453, 84532],
    requiresErc4626: false,
    requiresSanovaToken: true,
    institutionalReview: true,
    requirements: [
      ...BASE_REQUIREMENTS,
      { id: 'purchaseContractUploaded', labelKey: 'purchaseContractUploaded', weight: 10 },
      { id: 'liquidityPlanDocumented', labelKey: 'liquidityPlanDocumented', weight: 10 },
      { id: 'debtInstrumentType', labelKey: 'debtInstrumentType', weight: 10 },
      { id: 'maturityDateSet', labelKey: 'maturityDateSet', weight: 8 }
    ]
  },
  {
    id: 'CLEARPOOL',
    name: 'Clearpool',
    category: 'credit_pool',
    envCredentialKeys: ['CLEARPOOL_API_KEY', 'CLEARPOOL_BORROWER_ID'],
    docsUrl: 'https://docs.clearpool.finance',
    minTokenSupply: 10000,
    supportedChainIds: [1, 8453, 137],
    requiresErc4626: false,
    requiresSanovaToken: true,
    institutionalReview: true,
    requirements: [
      ...BASE_REQUIREMENTS,
      { id: 'legalAuditDone', labelKey: 'legalAuditDone', weight: 12 },
      { id: 'promoterEntitySet', labelKey: 'promoterEntitySet', weight: 8 },
      { id: 'debtInstrumentType', labelKey: 'debtInstrumentType', weight: 10 },
      { id: 'maturityDateSet', labelKey: 'maturityDateSet', weight: 8 }
    ]
  },
  {
    id: 'FIGURE',
    name: 'Figure Markets',
    category: 'provenance',
    envCredentialKeys: ['FIGURE_API_KEY', 'FIGURE_ORG_ID'],
    docsUrl: 'https://figure.com/markets',
    minTokenSupply: 5000,
    supportedChainIds: [1],
    requiresErc4626: false,
    requiresSanovaToken: true,
    institutionalReview: true,
    requirements: [
      ...BASE_REQUIREMENTS,
      { id: 'purchaseContractUploaded', labelKey: 'purchaseContractUploaded', weight: 10 },
      { id: 'leaseContractUploaded', labelKey: 'leaseContractUploaded', weight: 8 }
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
