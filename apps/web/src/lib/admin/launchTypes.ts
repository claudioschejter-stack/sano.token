export type TokenStandard = 'SANOVA_KYC' | 'ERC4626' | 'ERC7540' | 'THIRDWEB_DEMO';

export type TokenInstrumentType = 'DEBT' | 'EQUITY';

export type CentrifugeChecklist = {
  spvDocumented: boolean;
  legalAuditDone: boolean;
  navOracleConfigured: boolean;
  kycPolicyActive: boolean;
  liquidityPlanDocumented: boolean;
  smartContractVerified: boolean;
};

export const EMPTY_CENTRIFUGE_CHECKLIST: CentrifugeChecklist = {
  spvDocumented: false,
  legalAuditDone: false,
  navOracleConfigured: false,
  kycPolicyActive: false,
  liquidityPlanDocumented: false,
  smartContractVerified: false
};

export function parseCentrifugeChecklist(raw: unknown): CentrifugeChecklist {
  if (typeof raw !== 'object' || raw === null) {
    return { ...EMPTY_CENTRIFUGE_CHECKLIST };
  }

  const row = raw as Partial<CentrifugeChecklist>;
  return {
    spvDocumented: Boolean(row.spvDocumented),
    legalAuditDone: Boolean(row.legalAuditDone),
    navOracleConfigured: Boolean(row.navOracleConfigured),
    kycPolicyActive: Boolean(row.kycPolicyActive),
    liquidityPlanDocumented: Boolean(row.liquidityPlanDocumented),
    smartContractVerified: Boolean(row.smartContractVerified)
  };
}

export function centrifugeReadinessScore(checklist: CentrifugeChecklist): number {
  const values = Object.values(checklist);
  const done = values.filter(Boolean).length;
  return Math.round((done / values.length) * 100);
}

export function autoFillCentrifugeChecklist(input: {
  checklist: CentrifugeChecklist;
  hasTrustContract: boolean;
  hasNavOracleUrl: boolean;
  hasSpvName: boolean;
  tokenDeployed: boolean;
}): CentrifugeChecklist {
  return {
    ...input.checklist,
    spvDocumented: input.checklist.spvDocumented || input.hasTrustContract,
    navOracleConfigured: input.checklist.navOracleConfigured || input.hasNavOracleUrl,
    kycPolicyActive: input.checklist.kycPolicyActive || true,
    smartContractVerified: input.checklist.smartContractVerified || input.tokenDeployed
  };
}

export type LaunchMediaItem = {
  type: 'image' | 'reel';
  url: string;
  caption?: string;
};

export type CollateralProtocol =
  | 'CENTRIFUGE'
  | 'SKY'
  | 'MORPHO'
  | 'AAVE_HORIZON'
  | 'MAPLE'
  | 'CLEARPOOL'
  | 'FIGURE';

export type CollateralRegistrationStatus =
  | 'NOT_SELECTED'
  | 'BLOCKED'
  | 'READY'
  | 'QUEUED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'REGISTERED'
  | 'REJECTED'
  | 'FAILED';

export type MorphoLiquidityStatus = 'NOT_CHECKED' | 'NO_MARKET' | 'NO_LIQUIDITY' | 'LIQUID' | 'FAILED';
export type ExplorerVerificationStatus = 'NOT_REQUESTED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'SKIPPED';
export type ReadinessStatus = 'READY' | 'PENDING' | 'BLOCKED' | 'NOT_REQUIRED';

export type CollateralTarget = {
  protocol: CollateralProtocol;
  status: CollateralRegistrationStatus;
  readinessScore?: number;
  missingRequirements?: string[];
  externalId?: string | null;
  poolUrl?: string | null;
  oracleAddress?: string | null;
  notes?: string;
  lastError?: string | null;
  submittedAt?: string | null;
  registeredAt?: string | null;
};

export type DeploymentEvent = {
  id: string;
  step:
    | 'TOKEN_DEPLOY'
    | 'VAULT_DEPLOY'
    | 'VAULT_FUNDING'
    | 'ORACLE_DEPLOY'
    | 'MORPHO_MARKET'
    | 'COLLATERAL_REGISTER'
    | 'REPAIR_AUTOMATION'
    | 'PREFLIGHT'
    | 'EXPLORER_VERIFY'
    | 'LAUNCH_FINALIZE'
    | 'MORPHO_LIQUIDITY'
    | 'CIRCUIT_BREAKER'
    | 'KYC_ALLOWLIST'
    | 'OWNERSHIP_TRANSFER'
    | 'PRICING_ORACLE'
    | 'READY_TO_BORROW'
    | 'SYNTHETIC_RWA_FLOW'
    | 'SECURITY_REPORT'
    | 'BALANCE_MONITOR'
    | 'YIELD_CONVERT'
    | 'YIELD_DISTRIBUTE';
  status: 'PENDING' | 'SUCCESS' | 'SKIPPED' | 'FAILED';
  message: string;
  txHash?: string | null;
  address?: string | null;
  externalId?: string | null;
  auditHash?: string | null;
  createdAt: string;
};

export type AutomationReadinessItem = {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
};

export type AutomationReadinessSummary = {
  status: ReadinessStatus;
  score: number;
  items: AutomationReadinessItem[];
  updatedAt: string;
};

export function instrumentTypeDefaults(type: TokenInstrumentType): {
  tokenStandard: TokenStandard;
  collateralProtocols: CollateralProtocol[];
} {
  if (type === 'DEBT') {
    return {
      tokenStandard: 'ERC4626',
      collateralProtocols: ['MAPLE', 'CLEARPOOL', 'CENTRIFUGE']
    };
  }

  return {
    tokenStandard: 'SANOVA_KYC',
    collateralProtocols: ['CENTRIFUGE', 'MORPHO']
  };
}

export type TokenDeployStatus = 'NOT_REQUESTED' | 'PENDING' | 'DEPLOYED' | 'FAILED' | 'SKIPPED';

export type VaultFundingStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'FUNDED'
  | 'NO_TOKENS'
  | 'FAILED'
  | 'SKIPPED';

export type LaunchContracts = {
  trust?: string | null;
  purchase?: string | null;
  lease?: string | null;
  smartContract?: string | null;
};

export function buildMapEmbedUrl(location: string, latitude?: number | null, longitude?: number | null): string {
  if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `https://maps.google.com/maps?q=${latitude},${longitude}&hl=es&z=16&output=embed`;
  }

  const query = encodeURIComponent(location);
  return `https://maps.google.com/maps?q=${query}&hl=es&z=14&output=embed`;
}

export function parseMediaGallery(raw: unknown): LaunchMediaItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(
    (item): item is LaunchMediaItem =>
      typeof item === 'object' &&
      item !== null &&
      (item as LaunchMediaItem).type !== undefined &&
      typeof (item as LaunchMediaItem).url === 'string'
  );
}

export function parseCollateralTargets(raw: unknown): CollateralTarget[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (item): item is CollateralTarget =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as CollateralTarget).protocol === 'string'
    )
    .map((item) => ({
      ...item,
      status: item.status ?? 'QUEUED',
      readinessScore: item.readinessScore ?? 0,
      missingRequirements: item.missingRequirements ?? []
    }));
}

export function parseDeploymentEvents(raw: unknown): DeploymentEvent[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (item): item is DeploymentEvent =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as DeploymentEvent).step === 'string' &&
        typeof (item as DeploymentEvent).status === 'string'
    )
    .map((item) => ({
      ...item,
      id: item.id ?? `${item.step}-${Date.now().toString(36)}`,
      message: item.message ?? item.step,
      createdAt: item.createdAt ?? new Date().toISOString()
    }));
}

export function parseAutomationReadiness(raw: unknown): AutomationReadinessSummary | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const row = raw as Partial<AutomationReadinessSummary>;
  if (!Array.isArray(row.items)) {
    return null;
  }

  return {
    status: row.status ?? 'PENDING',
    score: typeof row.score === 'number' ? row.score : 0,
    items: row.items.filter((item): item is AutomationReadinessItem => typeof item === 'object' && item !== null),
    updatedAt: row.updatedAt ?? new Date().toISOString()
  };
}
