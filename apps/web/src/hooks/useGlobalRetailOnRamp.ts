'use client';

import { useFundWallet, useFiatOnramp } from '@privy-io/react-auth';
import { useCallback } from 'react';
import { base } from 'viem/chains';
import { usePrivyEmbeddedWallet } from './usePrivyEmbeddedWallet';
import { usePrivyWalletLink } from './usePrivyWalletLink';
import {
  PRIVY_FIAT_ONRAMP_BASE_CHAIN,
  resolvePrivyFiatOnRampSource
} from '../lib/payments/privyOnRampPolicy';

export type GlobalOnRampProvider = 'stripe' | 'moonpay' | 'coinbase';

export type StartGlobalRetailOnRampInput = {
  amountUsd: number;
  countryCode: string;
  /** Embedded wallet receives USDC on Base; treasury swap + mint happens server-side. */
  destinationAddress?: `0x${string}` | null;
  preferredProvider?: GlobalOnRampProvider;
};

function mapPreferredProvider(provider: GlobalOnRampProvider): 'coinbase' | 'moonpay' {
  if (provider === 'coinbase') {
    return 'coinbase';
  }
  return 'moonpay';
}

function isFundComplete(status: string): boolean {
  return status === 'submitted' || status === 'confirmed' || status === 'success';
}

export function useGlobalRetailOnRamp() {
  const { fundWallet } = useFundWallet();
  const { fund: fiatOnRamp } = useFiatOnramp();
  const { enabled, ready, authenticated, address, ensureReady } = usePrivyEmbeddedWallet();
  const { linkPrivyWallet } = usePrivyWalletLink();

  const startOnRamp = useCallback(
    async (input: StartGlobalRetailOnRampInput) => {
      if (!enabled || !ready) {
        throw new Error('PRIVY_NOT_CONFIGURED');
      }

      let walletAddress = input.destinationAddress ?? address;
      if (!authenticated || !walletAddress) {
        const linked = await linkPrivyWallet();
        walletAddress = linked ?? walletAddress;
      }
      if (!walletAddress) {
        walletAddress = await ensureReady();
        await linkPrivyWallet();
      }
      if (!walletAddress) {
        throw new Error('PRIVY_WALLET_REQUIRED');
      }

      const preferredProvider = input.preferredProvider ?? 'stripe';
      const fiatSource = resolvePrivyFiatOnRampSource(input.countryCode);

      try {
        await fundWallet({
          address: walletAddress,
          options: {
            amount: input.amountUsd.toFixed(2),
            chain: base,
            asset: 'USDC',
            defaultFundingMethod: 'card',
            card: {
              preferredProvider: mapPreferredProvider(
                preferredProvider === 'stripe' ? 'moonpay' : preferredProvider
              )
            }
          }
        });
        return { provider: 'useFundWallet', status: 'submitted' as const };
      } catch (legacyError) {
        const message = legacyError instanceof Error ? legacyError.message : '';
        if (message.toLowerCase().includes('closed') || message.toLowerCase().includes('cancel')) {
          throw legacyError;
        }
      }

      const fundResult = await fiatOnRamp({
        source: {
          assets: fiatSource.assets as Parameters<typeof fiatOnRamp>[0]['source']['assets'],
          defaultAsset: fiatSource.defaultAsset as Parameters<typeof fiatOnRamp>[0]['source']['defaultAsset']
        },
        destination: {
          asset: 'usdc',
          chain: PRIVY_FIAT_ONRAMP_BASE_CHAIN,
          address: walletAddress
        },
        defaultAmount: input.amountUsd.toFixed(2),
        environment: 'production'
      });

      if (!isFundComplete(fundResult.status)) {
        throw new Error('PRIVY_FUND_INCOMPLETE');
      }

      return { provider: 'useFiatOnramp', status: fundResult.status };
    },
    [address, authenticated, ensureReady, fiatOnRamp, fundWallet, linkPrivyWallet, enabled, ready]
  );

  return { startOnRamp, privyReady: enabled && ready };
}
