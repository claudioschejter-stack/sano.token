'use client';

import '@rainbow-me/rainbowkit/styles.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '../../lib/web3/config';

type Web3ProvidersProps = {
  children: ReactNode;
};

export function Web3Providers({ children }: Web3ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000
          }
        }
      })
  );

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#2563eb',
            accentColorForeground: 'white',
            borderRadius: 'medium'
          })}
          modalSize="compact"
          initialChain={wagmiConfig.chains[0]}
          appInfo={{
            appName: 'Sanova Global',
            learnMoreUrl: 'https://sano-token-web.vercel.app/terminos'
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Alias — Wagmi v2 + RainbowKit con auto-reconnect (`reconnectOnMount`). */
export const Providers = Web3Providers;
