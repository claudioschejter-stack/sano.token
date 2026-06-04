const MAX_WALLET_PROVIDER_LENGTH = 64;

export function sanitizeWalletProvider(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, MAX_WALLET_PROVIDER_LENGTH);
}

/** Human-readable wallet app name from wagmi connector or connect flow. */
export function normalizeWalletDisplayName(
  connectorName: string | undefined,
  flow: 'coinbase' | 'walletconnect' | null = null
): string | null {
  if (connectorName) {
    const lower = connectorName.toLowerCase();
    if (lower.includes('coinbase')) {
      return 'Coinbase Wallet';
    }
    if (lower.includes('metamask')) {
      return 'MetaMask';
    }
    if (lower.includes('rainbow')) {
      return 'Rainbow';
    }
    if (lower.includes('trust')) {
      return 'Trust Wallet';
    }
    if (lower.includes('rabby')) {
      return 'Rabby';
    }
    if (lower.includes('phantom')) {
      return 'Phantom';
    }
    return connectorName.trim();
  }

  if (flow === 'coinbase') {
    return 'Coinbase Wallet';
  }

  return null;
}

export function resolveWalletProviderForLink(input: {
  connectorName?: string;
  activeFlow?: 'coinbase' | 'walletconnect' | null;
  explicitProvider?: string | null;
}): string | null {
  return sanitizeWalletProvider(
    input.explicitProvider ??
      normalizeWalletDisplayName(input.connectorName, input.activeFlow ?? null)
  );
}
