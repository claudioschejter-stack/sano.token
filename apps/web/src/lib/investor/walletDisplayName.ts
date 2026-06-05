const MAX_WALLET_PROVIDER_LENGTH = 64;

export function sanitizeWalletProvider(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, MAX_WALLET_PROVIDER_LENGTH);
}

/** Human-readable wallet app name — platform uses Coinbase Wallet only. */
export function normalizeWalletDisplayName(
  connectorName?: string,
  _flow: 'coinbase' | null = null
): string | null {
  if (connectorName?.toLowerCase().includes('coinbase')) {
    return 'Coinbase Wallet';
  }
  return connectorName?.trim() ? 'Coinbase Wallet' : 'Coinbase Wallet';
}

export function resolveWalletProviderForLink(input: {
  connectorName?: string;
  activeFlow?: 'coinbase' | null;
  explicitProvider?: string | null;
}): string | null {
  return sanitizeWalletProvider(input.explicitProvider ?? 'Coinbase Wallet');
}
