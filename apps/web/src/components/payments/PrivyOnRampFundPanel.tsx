'use client';

import { useFiatOnramp } from '@privy-io/react-auth';
import { Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { usePrivyEmbeddedWallet } from '../../hooks/usePrivyEmbeddedWallet';
import { usePrivyWalletLink } from '../../hooks/usePrivyWalletLink';
import { usePrivyTreasuryPayment } from '../../hooks/usePrivyTreasuryPayment';
import { usePrivyVaultDeposit } from '../../hooks/usePrivyVaultDeposit';
import {
  PRIVY_FIAT_ONRAMP_BASE_CHAIN,
  resolvePrivyFiatOnRampSource
} from '../../lib/payments/privyOnRampPolicy';
import type { VaultDepositLine } from '../../lib/web3/vaultDepositPayment';

export type PrivyOnRampFundPanelProps = {
  metadata: Record<string, unknown> | null | undefined;
  amountUsd: number;
  stablecoinNetwork?: string;
  /** When set, USDC is deposited into ERC-4626 vault(s) instead of treasury transfer. */
  vaultDeposits?: VaultDepositLine[];
  onFunded?: (txHash: `0x${string}`) => void | Promise<void>;
  onError?: (message: string) => void;
};

function resolveCountry(metadata: Record<string, unknown> | null | undefined): string {
  if (typeof metadata?.country === 'string' && metadata.country.trim()) {
    return metadata.country.trim().toUpperCase();
  }
  return 'US';
}

function isPrivyFundComplete(status: string): boolean {
  return status === 'submitted' || status === 'confirmed';
}

export function PrivyOnRampFundPanel({
  metadata,
  amountUsd,
  stablecoinNetwork = 'BASE',
  vaultDeposits,
  onFunded,
  onError
}: PrivyOnRampFundPanelProps) {
  const { fund } = useFiatOnramp();
  const { enabled, ready, authenticated, address, ensureReady } = usePrivyEmbeddedWallet();
  const { linkPrivyWallet, linking } = usePrivyWalletLink();
  const { payToTreasury } = usePrivyTreasuryPayment();
  const { depositToVaults } = usePrivyVaultDeposit();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'idle' | 'funding' | 'paying' | 'depositing' | 'done'>('idle');
  const usesVaultDeposit = Boolean(vaultDeposits?.length);

  const country = useMemo(() => resolveCountry(metadata), [metadata]);
  const fiatSource = useMemo(() => resolvePrivyFiatOnRampSource(country), [country]);
  const fiatAsset = useMemo(() => {
    if (typeof metadata?.fiatAsset === 'string' && metadata.fiatAsset.trim()) {
      return metadata.fiatAsset.trim().toLowerCase();
    }
    return fiatSource.defaultAsset;
  }, [fiatSource.defaultAsset, metadata?.fiatAsset]);

  const runPrivyOnRamp = useCallback(async () => {
    if (!enabled || !ready) {
      onError?.('PRIVY_NOT_CONFIGURED');
      return;
    }

    setBusy(true);
    setStep('funding');

    try {
      let walletAddress = address;
      if (!authenticated || !walletAddress) {
        const linked = await linkPrivyWallet();
        if (linked) {
          walletAddress = linked;
        }
      }
      if (!walletAddress) {
        walletAddress = await ensureReady();
        await linkPrivyWallet();
      }

      const fundResult = await fund({
        source: {
          assets: fiatSource.assets as Parameters<typeof fund>[0]['source']['assets'],
          defaultAsset: fiatAsset as Parameters<typeof fund>[0]['source']['defaultAsset']
        },
        destination: {
          asset: 'usdc',
          chain: PRIVY_FIAT_ONRAMP_BASE_CHAIN,
          address: walletAddress
        },
        defaultAmount: amountUsd.toFixed(2),
        environment: 'production'
      });

      if (!isPrivyFundComplete(fundResult.status)) {
        throw new Error('PRIVY_FUND_INCOMPLETE');
      }

      setStep(usesVaultDeposit ? 'depositing' : 'paying');
      const txHash = usesVaultDeposit
        ? await depositToVaults({ stablecoinNetwork, deposits: vaultDeposits! })
        : await payToTreasury({ amountUsd, stablecoinNetwork });
      setStep('done');
      await onFunded?.(txHash);
    } catch (fundError) {
      const message = fundError instanceof Error ? fundError.message : 'PRIVY_FUND_FAILED';
      if (!message.toLowerCase().includes('closed') && !message.toLowerCase().includes('cancel')) {
        onError?.(message);
      }
      setStep('idle');
    } finally {
      setBusy(false);
    }
  }, [
    address,
    amountUsd,
    authenticated,
    depositToVaults,
    enabled,
    ensureReady,
    fiatAsset,
    fiatSource.assets,
    fund,
    linkPrivyWallet,
    onError,
    onFunded,
    payToTreasury,
    ready,
    stablecoinNetwork,
    usesVaultDeposit,
    vaultDeposits
  ]);

  if (!enabled) {
    return (
      <p className="text-xs text-terminal-warning">
        Configurá NEXT_PUBLIC_PRIVY_APP_ID para habilitar el on-ramp Privy.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-3 text-sm text-terminal-text">
      <p className="font-semibold text-terminal-primary">On-ramp Privy (tarjeta / transferencia)</p>
      <p className="text-xs text-terminal-muted">
        {usesVaultDeposit
          ? `Comprás USDC en Base con ${fiatAsset.toUpperCase()} y canjeamos automáticamente por tokens ERC-4626 en tu wallet.`
          : `Comprás USDC en Base con ${fiatAsset.toUpperCase()} y enviamos el pago al treasury para acreditar tus shares.`}{' '}
        Privy enruta automáticamente a Stripe, MoonPay, Coinbase, Bridge u otros proveedores habilitados en tu dashboard.
      </p>
      {step === 'done' ? (
        <p className="text-xs font-medium text-emerald-700">
          {usesVaultDeposit
            ? 'Tokens ERC-4626 acreditados en tu wallet. Confirmando…'
            : 'Pago enviado al treasury. Confirmando…'}
        </p>
      ) : (
        <button
          type="button"
          disabled={busy || linking || !ready}
          onClick={() => void runPrivyOnRamp()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy || linking ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          {step === 'depositing'
            ? 'Canjeando USDC por tokens ERC-4626…'
            : step === 'paying'
              ? 'Enviando USDC al treasury…'
              : step === 'funding'
                ? 'Abriendo on-ramp Privy…'
                : `Pagar ${amountUsd.toFixed(2)} USD con Privy`}
        </button>
      )}
    </div>
  );
}
