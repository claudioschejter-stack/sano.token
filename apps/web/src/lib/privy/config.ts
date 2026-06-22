import { base } from 'viem/chains';
import type { PrivyClientConfig } from '@privy-io/react-auth';

const DEFAULT_PRIVY_LOGIN_METHODS = ['email', 'sms'] as const;

export type PrivyLoginMethod = 'email' | 'sms' | 'google' | 'apple' | 'wallet';

export function resolvePrivyLoginMethods(): PrivyLoginMethod[] {
  const raw = process.env.NEXT_PUBLIC_PRIVY_LOGIN_METHODS?.trim();
  if (!raw) {
    return [...DEFAULT_PRIVY_LOGIN_METHODS];
  }

  const allowed = new Set<PrivyLoginMethod>(['email', 'sms', 'google', 'apple', 'wallet']);
  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is PrivyLoginMethod => allowed.has(item as PrivyLoginMethod));

  return parsed.length > 0 ? parsed : [...DEFAULT_PRIVY_LOGIN_METHODS];
}

export function isPrivyEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim());
}

export function privyAppId(): string {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? '';
}

/** Privy Earn vault — ERC-4626 yield (Morpho/Aave on Base). Set in Dashboard → Earn. */
export function privyVaultId(): string {
  return process.env.PRIVY_VAULT_ID?.trim() ?? '';
}

function parsePrivyEarnVaultAddressMap(): Record<string, string> {
  const raw = process.env.PRIVY_EARN_VAULT_BY_ADDRESS?.trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([address, vaultId]) => Boolean(address?.trim() && vaultId?.trim()))
        .map(([address, vaultId]) => [address.trim().toLowerCase(), vaultId.trim()])
    );
  } catch {
    return {};
  }
}

/** Map on-chain vault address → Privy Earn vault_id (Dashboard → Earn). */
export function resolvePrivyEarnVaultId(vaultAddress?: string | null): string | null {
  const defaultVaultId = privyVaultId();
  if (!vaultAddress?.trim()) {
    return defaultVaultId || null;
  }

  const normalized = vaultAddress.trim().toLowerCase();
  const mapped = parsePrivyEarnVaultAddressMap()[normalized];
  if (mapped) {
    return mapped;
  }

  const defaultVaultAddress = process.env.PRIVY_EARN_DEFAULT_VAULT_ADDRESS?.trim().toLowerCase();
  if (defaultVaultId && defaultVaultAddress && normalized === defaultVaultAddress) {
    return defaultVaultId;
  }

  return null;
}

export function canUsePrivyEarnForVaultAddress(vaultAddress: string): boolean {
  return Boolean(resolvePrivyEarnVaultId(vaultAddress));
}

/** Unique Privy Earn vault IDs configured for this app (env map + default), stable display order. */
export function listConfiguredPrivyEarnVaultIds(): string[] {
  const ids = new Set<string>();
  const defaultId = privyVaultId();
  if (defaultId) {
    ids.add(defaultId);
  }
  for (const vaultId of Object.values(parsePrivyEarnVaultAddressMap())) {
    ids.add(vaultId);
  }

  const ordered = privyEarnVaultDisplayOrder().filter((vaultId) => ids.has(vaultId));
  for (const vaultId of ids) {
    if (!ordered.includes(vaultId)) {
      ordered.push(vaultId);
    }
  }
  return ordered;
}

/** On-chain vault address → Privy vault_id entries from env (lowercase addresses). */
export function listConfiguredPrivyEarnVaultAddressEntries(): Array<{ vaultAddress: string; vaultId: string }> {
  return Object.entries(parsePrivyEarnVaultAddressMap()).map(([vaultAddress, vaultId]) => ({
    vaultAddress,
    vaultId
  }));
}

const DEFAULT_PRIVY_EARN_VAULT_LABELS: Record<string, string> = {
  f738pgj75dy85kqkb8bh86dd: 'Gauntlet USDC Prime',
  y9g5a6qf1z50izbyxqbpy3go: 'Steakhouse Prime USDC'
};

const DEFAULT_PRIVY_EARN_VAULT_ORDER = [
  'f738pgj75dy85kqkb8bh86dd',
  'y9g5a6qf1z50izbyxqbpy3go'
] as const;

function parsePrivyEarnVaultLabels(): Record<string, string> {
  const raw = process.env.PRIVY_EARN_VAULT_LABELS?.trim();
  if (!raw) {
    return DEFAULT_PRIVY_EARN_VAULT_LABELS;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return { ...DEFAULT_PRIVY_EARN_VAULT_LABELS, ...parsed };
  } catch {
    return DEFAULT_PRIVY_EARN_VAULT_LABELS;
  }
}

export function resolvePrivyEarnVaultDisplayName(vaultId: string, fallback?: string | null): string {
  const normalized = vaultId.trim();
  return parsePrivyEarnVaultLabels()[normalized] ?? fallback?.trim() ?? normalized;
}

export function privyEarnVaultDisplayOrder(): string[] {
  const raw = process.env.PRIVY_EARN_VAULT_ORDER?.trim();
  if (!raw) {
    return [...DEFAULT_PRIVY_EARN_VAULT_ORDER];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolvePrivyEarnVaultAddressById(vaultId: string): string | null {
  const normalizedId = vaultId.trim();
  for (const [address, mappedId] of Object.entries(parsePrivyEarnVaultAddressMap())) {
    if (mappedId === normalizedId) {
      return address;
    }
  }

  if (normalizedId === privyVaultId()) {
    return process.env.PRIVY_EARN_DEFAULT_VAULT_ADDRESS?.trim() || null;
  }

  return null;
}

export function isPrivyEarnConfigured(): boolean {
  return Boolean(privyAppId() && privyVaultId() && process.env.PRIVY_APP_SECRET?.trim());
}

/** Treasury Privy wallet ID used for earn deposit/withdraw API calls. */
export function privyTreasuryWalletId(): string {
  return process.env.PRIVY_TREASURY_WALLET_ID?.trim() ?? '';
}

/** Privy server wallet that signs as owner of TOKEN_TREASURY Safe. */
export function privySafeOwnerWalletId(): string {
  return process.env.PRIVY_SAFE_OWNER_WALLET_ID?.trim() ?? '';
}

export function privySafeOwnerAddress(): string | null {
  return process.env.TREASURY_OWNER_ADDRESS?.trim() || null;
}

export function isPrivySafeOwnerConfigured(): boolean {
  return Boolean(
    privyAppId() &&
      process.env.PRIVY_APP_SECRET?.trim() &&
      privySafeOwnerWalletId() &&
      privySafeOwnerAddress()
  );
}

/** Privy server wallet dedicated to Morpho Blue USDC supply/withdraw. */
export function privyMorphoLiquidityWalletId(): string {
  return process.env.PRIVY_MORPHO_LIQUIDITY_WALLET_ID?.trim() ?? '';
}

export function privyMorphoLiquidityAddress(): string | null {
  return process.env.MORPHO_LIQUIDITY_ADDRESS?.trim() || null;
}

export function isPrivyMorphoLiquidityConfigured(): boolean {
  return Boolean(
    privyAppId() &&
      process.env.PRIVY_APP_SECRET?.trim() &&
      privyMorphoLiquidityWalletId() &&
      privyMorphoLiquidityAddress()
  );
}

/** Privy server wallet — deploy tokens/vaults, Morpho markets, NAV oracle updates. */
export function privyOperatorWalletId(): string {
  return process.env.PRIVY_OPERATOR_WALLET_ID?.trim() ?? '';
}

export function resolveRwaOperatorAddressEnv(): string | null {
  return process.env.RWA_OPERATOR_ADDRESS?.trim() || null;
}

export function isPrivyOperatorConfigured(): boolean {
  return Boolean(
    privyAppId() &&
      process.env.PRIVY_APP_SECRET?.trim() &&
      privyOperatorWalletId() &&
      resolveRwaOperatorAddressEnv()
  );
}

/** JWKS endpoint to verify Privy-issued access tokens (server-side). */
export function privyJwksUrl(): string {
  const id = privyAppId();
  return id ? `https://auth.privy.io/api/v1/apps/${id}/jwks.json` : '';
}

/** Privy embedded wallet on Base — email/SMS login until Google OAuth is configured in Privy Dashboard. */
export const privyClientConfig: PrivyClientConfig = {
  loginMethods: resolvePrivyLoginMethods(),
  appearance: {
    theme: 'light',
    accentColor: '#2563eb',
    showWalletLoginFirst: false
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets'
    },
    /** Enable gas sponsorship in Privy Dashboard → Settings → Gas */
    showWalletUIs: false
  },
  defaultChain: base,
  supportedChains: [base]
};
