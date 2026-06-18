import { base } from 'viem/chains';
import type { PrivyClientConfig } from '@privy-io/react-auth';

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

export function isPrivyEarnConfigured(): boolean {
  return Boolean(privyAppId() && privyVaultId() && process.env.PRIVY_APP_SECRET?.trim());
}

/** Treasury Privy wallet ID used for earn deposit/withdraw API calls. */
export function privyTreasuryWalletId(): string {
  return process.env.PRIVY_TREASURY_WALLET_ID?.trim() ?? '';
}

/** JWKS endpoint to verify Privy-issued access tokens (server-side). */
export function privyJwksUrl(): string {
  const id = privyAppId();
  return id ? `https://auth.privy.io/api/v1/apps/${id}/jwks.json` : '';
}

/** Privy embedded wallet on Base — User Pays gas in USDC; mobile-first login. */
export const privyClientConfig: PrivyClientConfig = {
  loginMethods: ['email', 'google', 'apple', 'sms'],
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
