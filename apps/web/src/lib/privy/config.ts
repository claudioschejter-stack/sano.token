import { base } from 'viem/chains';
import type { PrivyClientConfig } from '@privy-io/react-auth';

export function isPrivyEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim());
}

export function privyAppId(): string {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? '';
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
    }
  },
  defaultChain: base,
  supportedChains: [base]
};
