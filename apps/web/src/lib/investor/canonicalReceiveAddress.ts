/**
 * Invariant: the Sanova USDC receive address shown to investors (copy/QR)
 * MUST come from the server-linked wallet, never from the Privy browser SDK.
 *
 * Root incident (2026-07-31): checkout preferred the client Privy address
 * (`0x840aed…`) while balance/watch used the server-linked wallet
 * (`0xb311…`), so Ripio funded an address the app did not credit.
 */
export function resolveDisplayReceiveAddress(input: {
  serverLinkedAddress?: string | null;
  privyClientAddress?: string | null;
}): string | null {
  const server = input.serverLinkedAddress?.trim();
  if (server) {
    return server;
  }
  // Deliberately ignore privyClientAddress — funding destination is server-owned.
  void input.privyClientAddress;
  return null;
}

/** True when client Privy session drifted from the canonical receive wallet. */
export function isReceiveAddressDrift(input: {
  serverLinkedAddress?: string | null;
  privyClientAddress?: string | null;
}): boolean {
  const server = input.serverLinkedAddress?.trim().toLowerCase();
  const client = input.privyClientAddress?.trim().toLowerCase();
  if (!server || !client) {
    return false;
  }
  return server !== client;
}
