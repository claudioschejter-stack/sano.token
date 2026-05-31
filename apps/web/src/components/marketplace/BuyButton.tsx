'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CheckCircle2, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useBuyToken, type BuyTokenStatus } from '../../hooks/useBuyToken';
import { BASE_CHAIN_ID, BASE_USDC_ADDRESS, isWalletConnectConfigured } from '../../lib/web3/config';

export type BuyButtonProps = {
  vaultAddress?: string | null;
  usdcAddress?: string | null;
  amountUsd: string;
  usdcDecimals?: number;
  chainId?: number;
  disabled?: boolean;
  className?: string;
  /** Create payment intent / pre-checks before on-chain deposit. */
  onPrepare?: () => Promise<{ paymentIntentId: string } | undefined>;
  /** Called after successful ERC-4626 deposit (e.g. verify with backend). */
  onSuccess?: (result: { depositTxHash: string; paymentIntentId?: string }) => void | Promise<void>;
};

function statusLabel(status: BuyTokenStatus, t: ReturnType<typeof useTranslation>): string {
  switch (status) {
    case 'checking':
      return t.wallet.buyChecking;
    case 'approving':
      return t.wallet.buyApproving;
    case 'depositing':
      return t.wallet.buyDepositing;
    case 'success':
      return t.wallet.buySuccess;
    case 'error':
      return t.wallet.buyError;
    default:
      return t.wallet.buyOneClick;
  }
}

function explorerTxUrl(chainId: number, txHash: string): string {
  if (chainId === BASE_CHAIN_ID) {
    return `https://basescan.org/tx/${txHash}`;
  }
  return `https://basescan.org/tx/${txHash}`;
}

export function BuyButton({
  vaultAddress,
  usdcAddress,
  amountUsd,
  usdcDecimals = 6,
  chainId = BASE_CHAIN_ID,
  disabled = false,
  className = '',
  onPrepare,
  onSuccess
}: BuyButtonProps) {
  const t = useTranslation();
  const { buy, reset, status, error, depositTxHash, approveTxHash, isConnected, address, chainId: walletChainId } =
    useBuyToken();

  const isBusy = ['checking', 'approving', 'depositing'].includes(status);
  const canBuy = Boolean(vaultAddress && usdcAddress && Number.parseFloat(amountUsd) > 0);

  const resolvedUsdc = (usdcAddress ?? BASE_USDC_ADDRESS) as `0x${string}`;
  const resolvedVault = vaultAddress as `0x${string}` | undefined;

  const wrongChain = isConnected && walletChainId != null && walletChainId !== chainId;

  const handleBuy = useCallback(async () => {
    if (!resolvedVault || !canBuy) return;

    try {
      const prepared = await onPrepare?.();
      const result = await buy({
        vaultAddress: resolvedVault,
        usdcAddress: resolvedUsdc,
        amountUsd,
        usdcDecimals,
        chainId
      });

      await onSuccess?.({
        depositTxHash: result.depositTxHash,
        paymentIntentId: prepared?.paymentIntentId
      });
    } catch {
      // Error state handled inside hook
    }
  }, [amountUsd, buy, canBuy, chainId, onPrepare, onSuccess, resolvedUsdc, resolvedVault, usdcDecimals]);

  const label = statusLabel(status, t);

  const connectLabel = isWalletConnectConfigured ? t.wallet.connectWallet : t.wallet.connectCoinbase;

  if (!isConnected) {
    return (
      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => (
          <button
            type="button"
            onClick={openConnectModal}
            disabled={!mounted || disabled}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-3 text-sm font-semibold text-terminal-primary hover:bg-terminal-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          >
            {connectLabel}
          </button>
        )}
      </ConnectButton.Custom>
    );
  }

  if (wrongChain) {
    return (
      <ConnectButton.Custom>
        {({ openChainModal }) => (
          <button
            type="button"
            onClick={openChainModal}
            className={`w-full rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 text-sm font-semibold text-terminal-warning ${className}`}
          >
            {t.wallet.wrongNetwork}
          </button>
        )}
      </ConnectButton.Custom>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {!canBuy ? (
        <p className="rounded-lg border border-terminal-warning/30 bg-terminal-warning/10 px-3 py-2 text-xs text-terminal-warning">
          {t.wallet.vaultNotConfigured}
        </p>
      ) : null}

      <button
        type="button"
        disabled={disabled || isBusy || !canBuy || status === 'success'}
        onClick={() => void handleBuy()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
        {status === 'success' ? <CheckCircle2 size={16} aria-hidden /> : null}
        {status === 'error' ? <AlertCircle size={16} aria-hidden /> : null}
        {label}
      </button>

      {address ? (
        <p className="text-center text-xs text-terminal-muted">
          {address.slice(0, 6)}…{address.slice(-4)} · Base · ERC-4626
        </p>
      ) : null}

      {status === 'success' && depositTxHash ? (
        <div className="rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-3 py-2 text-xs text-terminal-success">
          <p className="font-semibold">{t.wallet.buySuccessDetail}</p>
          <a
            href={explorerTxUrl(chainId, depositTxHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            {t.wallet.viewTx} <ExternalLink size={12} />
          </a>
          {approveTxHash ? (
            <p className="mt-1 text-terminal-muted">
              Approve: {approveTxHash.slice(0, 10)}…
            </p>
          ) : null}
        </div>
      ) : null}

      {status === 'error' && error ? (
        <div className="space-y-2 rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-3 py-2 text-xs text-terminal-warning">
          <p>{error === 'USER_REJECTED' ? t.wallet.userRejected : error}</p>
          <button type="button" onClick={reset} className="font-semibold underline-offset-2 hover:underline">
            {t.wallet.retry}
          </button>
        </div>
      ) : null}
    </div>
  );
}
