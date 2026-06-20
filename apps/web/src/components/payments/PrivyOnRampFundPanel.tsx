'use client';

import { useFundWallet } from '@privy-io/react-auth';
import { Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { base } from 'viem/chains';
import { usePrivyEmbeddedWallet } from '../../hooks/usePrivyEmbeddedWallet';
import { usePrivyWalletLink } from '../../hooks/usePrivyWalletLink';
import { usePrivyTreasuryPayment } from '../../hooks/usePrivyTreasuryPayment';
import { usePrivyVaultDeposit } from '../../hooks/usePrivyVaultDeposit';
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

export function PrivyOnRampFundPanel({
  metadata,
  amountUsd,
  stablecoinNetwork = 'BASE',
  vaultDeposits,
  onFunded,
  onError
}: PrivyOnRampFundPanelProps) {
  const { fundWallet } = useFundWallet();
  const { enabled, ready, authenticated, address, ensureReady } = usePrivyEmbeddedWallet();
  const { linkPrivyWallet, linking } = usePrivyWalletLink();
  const { payToTreasury } = usePrivyTreasuryPayment();
  const { depositToVaults } = usePrivyVaultDeposit();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'idle' | 'funding' | 'paying' | 'depositing' | 'done'>('idle');
  const usesVaultDeposit = Boolean(vaultDeposits?.length);

  const fiatAsset = useMemo(() => {
    if (typeof metadata?.fiatAsset === 'string') {
      return metadata.fiatAsset;
    }
    return 'usd';
  }, [metadata?.fiatAsset]);

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

      await fundWallet({
        address: walletAddress,
        options: {
          chain: base,
          asset: 'USDC',
          amount: amountUsd.toFixed(2)
        }
      });

      setStep(usesVaultDeposit ? 'depositing' : 'paying');
      const txHash = usesVaultDeposit
        ? await depositToVaults({ stablecoinNetwork, deposits: vaultDeposits! })
        : await payToTreasury({ amountUsd, stablecoinNetwork });
      setStep('done');
      await onFunded?.(txHash);
    } catch (fundError) {
      const message = fundError instanceof Error ? fundError.message : 'PRIVY_FUND_FAILED';
      onError?.(message);
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
    fundWallet,
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
      <p className="font-semibold text-terminal-primary">On-ramp Privy (tarjeta / Apple Pay)</p>
      <p className="text-xs text-terminal-muted">
        {usesVaultDeposit
          ? `Comprás USDC en Base con ${fiatAsset.toUpperCase()} y canjeamos automáticamente por tokens ERC-4626 en tu wallet.`
          : `Comprás USDC en Base con ${fiatAsset.toUpperCase()} y enviamos el pago al treasury para acreditar tus shares.`}{' '}
        Prioridad: dLocal (SPEI/UPI) cuando esté disponible; Privy es el fallback internacional.
      </p>
      {step === 'done' ? (
        <p className="text-xs font-medium text-emerald-700">
          {usesVaultDeposit ? 'Tokens ERC-4626 acreditados en tu wallet. Confirmando…' : 'Pago enviado al treasury. Confirmando…'}
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
