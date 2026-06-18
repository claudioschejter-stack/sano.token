import { base } from 'viem/chains';
import type { PrivyClientConfig } from '@privy-io/react-auth';

export function isPrivyEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim());
}

export function privyAppId(): string {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? '';
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
