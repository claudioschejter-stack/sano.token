import type { AdminAssetRecord } from './assetsService';
import type { TokenStandard } from './launchTypes';
import { getTokenDeployStatus } from '../blockchain/tokenDeployConfig';

export type LaunchGateIssueCode =
  | 'MISSING_TITLE'
  | 'MISSING_DESCRIPTION'
  | 'MISSING_LOCATION'
  | 'MISSING_MEDIA'
  | 'INVALID_TOTAL_TOKENS'
  | 'INVALID_PRICE'
  | 'MISSING_TOKEN_SYMBOL'
  | 'MISSING_TOKEN_NAME'
  | 'DEPLOY_NOT_CONFIGURED'
  | 'DEPLOY_NO_GAS'
  | 'DEPLOY_RPC_ERROR'
  | 'TOKEN_NOT_DEPLOYED'
  | 'VAULT_NOT_DEPLOYED'
  | 'VAULT_NOT_FUNDED'
  | 'SMART_CONTRACT_NOT_LINKED'
  | 'DEPLOY_SKIPPED'
  | 'DEPLOY_FAILED'
  | 'AUTOMATION_BLOCKED'
  | 'MORPHO_REQUIRED_FOR_PUBLISH'
  | 'CANNOT_PUBLISH_INCOMPLETE';

export type LaunchGateIssue = {
  code: LaunchGateIssueCode;
  detail?: string;
};

export type Erc4626LaunchFormInput = {
  title?: string;
  description?: string;
  location?: string;
  totalTokens?: number;
  pricePerToken?: number;
  tokenName?: string | null;
  tokenSymbol?: string | null;
  mediaGallery?: Array<{ type: string; url: string }>;
  collateralMorpho?: boolean;
  isActive?: boolean;
};

export function isErc4626Standard(standard: string | undefined | null): boolean {
  return standard === 'ERC4626';
}

export function isErc4626OnChainReady(asset: {
  tokenStandard: string;
  tokenDeployStatus: string;
  contractAddress: string | null;
  vaultAddress: string | null;
  vaultFundingStatus: string;
  contracts?: { smartContract?: string | null };
  contractSmartUrl?: string | null;
}): boolean {
  if (!isErc4626Standard(asset.tokenStandard)) {
    return true;
  }

  const smartUrl = asset.contracts?.smartContract ?? asset.contractSmartUrl ?? null;

  return (
    asset.tokenDeployStatus === 'DEPLOYED' &&
    Boolean(asset.contractAddress) &&
    Boolean(asset.vaultAddress) &&
    asset.vaultFundingStatus === 'FUNDED' &&
    Boolean(smartUrl?.trim())
  );
}

export function getErc4626OnChainIssues(asset: {
  tokenStandard: string;
  tokenDeployStatus: string;
  contractAddress: string | null;
  vaultAddress: string | null;
  vaultFundingStatus: string;
  contracts?: { smartContract?: string | null };
  contractSmartUrl?: string | null;
}): LaunchGateIssue[] {
  if (!isErc4626Standard(asset.tokenStandard)) {
    return [];
  }

  const issues: LaunchGateIssue[] = [];

  if (!asset.contractAddress || asset.tokenDeployStatus !== 'DEPLOYED') {
    issues.push({
      code: 'TOKEN_NOT_DEPLOYED',
      detail: asset.tokenDeployStatus !== 'DEPLOYED' ? asset.tokenDeployStatus : undefined
    });
  }

  if (!asset.vaultAddress) {
    issues.push({ code: 'VAULT_NOT_DEPLOYED' });
  }

  if (asset.vaultFundingStatus !== 'FUNDED') {
    issues.push({
      code: 'VAULT_NOT_FUNDED',
      detail: asset.vaultFundingStatus
    });
  }

  const smartUrl = asset.contracts?.smartContract ?? asset.contractSmartUrl ?? null;
  if (!smartUrl?.trim()) {
    issues.push({ code: 'SMART_CONTRACT_NOT_LINKED' });
  }

  return issues;
}

export function validateErc4626LaunchForm(input: Erc4626LaunchFormInput): LaunchGateIssue[] {
  const issues: LaunchGateIssue[] = [];

  if (!input.title?.trim()) {
    issues.push({ code: 'MISSING_TITLE' });
  }
  if (!input.description?.trim()) {
    issues.push({ code: 'MISSING_DESCRIPTION' });
  }
  if (!input.location?.trim()) {
    issues.push({ code: 'MISSING_LOCATION' });
  }

  const gallery = input.mediaGallery ?? [];
  if (!gallery.some((item) => item.type === 'image' && item.url?.trim())) {
    issues.push({ code: 'MISSING_MEDIA' });
  }

  if (!Number.isInteger(input.totalTokens) || (input.totalTokens ?? 0) <= 0) {
    issues.push({ code: 'INVALID_TOTAL_TOKENS' });
  }

  if (!Number.isFinite(input.pricePerToken) || (input.pricePerToken ?? 0) <= 0) {
    issues.push({ code: 'INVALID_PRICE' });
  }

  if (!input.tokenSymbol?.trim()) {
    issues.push({ code: 'MISSING_TOKEN_SYMBOL' });
  }

  if (!input.tokenName?.trim() && !input.title?.trim()) {
    issues.push({ code: 'MISSING_TOKEN_NAME' });
  }

  if (input.isActive && input.collateralMorpho === false) {
    issues.push({ code: 'MORPHO_REQUIRED_FOR_PUBLISH' });
  }

  return issues;
}

export async function getDeployInfrastructureIssues(): Promise<LaunchGateIssue[]> {
  const health = await getTokenDeployStatus();
  const issues: LaunchGateIssue[] = [];

  if (!health.configured && !health.sanovaDirect) {
    issues.push({ code: 'DEPLOY_NOT_CONFIGURED' });
    return issues;
  }

  if (!health.deployerAddress) {
    issues.push({ code: 'DEPLOY_NOT_CONFIGURED' });
    return issues;
  }

  if (health.gasCheckError) {
    issues.push({ code: 'DEPLOY_RPC_ERROR', detail: health.gasCheckError });
  }

  if (!health.hasGas) {
    issues.push({
      code: 'DEPLOY_NO_GAS',
      detail: health.deployerAddress
    });
  }

  return issues;
}

export function needsErc4626Deploy(asset: {
  tokenStandard: string;
  contractAddress: string | null;
  vaultAddress: string | null;
  vaultFundingStatus: string;
  tokenDeployStatus: string;
}): boolean {
  if (!isErc4626Standard(asset.tokenStandard)) {
    return false;
  }

  return (
    asset.tokenDeployStatus !== 'DEPLOYED' ||
    !asset.contractAddress ||
    !asset.vaultAddress ||
    asset.vaultFundingStatus !== 'FUNDED'
  );
}

export function stripClientOnChainFieldsForErc4626<T extends Record<string, unknown>>(
  body: T,
  standard: TokenStandard | string | undefined
): T {
  if (!isErc4626Standard(standard)) {
    return body;
  }

  const next: Record<string, unknown> = { ...body };
  delete next.contractAddress;
  delete next.vaultAddress;
  delete next.vaultFundingStatus;
  delete next.vaultFundingAmount;
  delete next.vaultFundingTxHash;
  delete next.vaultFundingError;
  delete next.tokenDeployStatus;
  delete next.chainId;

  if (next.contracts && typeof next.contracts === 'object') {
    const contracts = { ...(next.contracts as Record<string, unknown>) };
    delete contracts.smartContract;
    next.contracts = contracts;
  }

  return next as T;
}

export function mergeLaunchGateIssues(...groups: LaunchGateIssue[][]): LaunchGateIssue[] {
  const seen = new Set<string>();
  const merged: LaunchGateIssue[] = [];

  for (const group of groups) {
    for (const issue of group) {
      const key = `${issue.code}:${issue.detail ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(issue);
    }
  }

  return merged;
}

export function launchGateIssueToMessage(
  issue: LaunchGateIssue,
  messages: Record<LaunchGateIssueCode, string>
): string {
  const base = messages[issue.code] ?? issue.code;
  return issue.detail ? `${base} (${issue.detail})` : base;
}

export function formatLaunchGateIssues(
  issues: LaunchGateIssue[],
  messages: Record<LaunchGateIssueCode, string>
): string {
  return issues.map((issue) => `• ${launchGateIssueToMessage(issue, messages)}`).join('\n');
}

export type Erc4626LaunchSaveResult =
  | { ok: true; asset: AdminAssetRecord }
  | { ok: false; issues: LaunchGateIssue[] };

export function deployResultToIssues(
  status: string,
  reason?: string
): LaunchGateIssue[] {
  if (status === 'DEPLOYED' || status === 'ALREADY_DEPLOYED') {
    return [];
  }

  if (status === 'SKIPPED') {
    return [{ code: 'DEPLOY_SKIPPED', detail: reason }];
  }

  return [{ code: 'DEPLOY_FAILED', detail: reason }];
}
