'use client';

import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatMessage } from '../../i18n';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useBuyToken } from '../../hooks/useBuyToken';
import { BASE_CHAIN_ID, BASE_USDC_ADDRESS } from '../../lib/web3/config';
import type { PublicPaymentIntent } from '../../lib/payments/paymentService';
import { CoinbaseConnectButton } from '../wallet/CoinbaseConnectButton';
import { WalletConnectConnectButton } from '../wallet/WalletConnectConnectButton';

type CartVaultDepositPanelProps = {
  paymentIntents: PublicPaymentIntent[];
  linkedWalletAddress: string;
  paymentOptionId?: string | null;
  disabled?: boolean;
  onComplete: () => void;
  onError: (message: string) => void;
};

type VaultDepositLine = {
  intent: PublicPaymentIntent;
  vaultAddress: string;
  projectTitle: string;
};

function explorerTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

function parseVaultLines(intents: PublicPaymentIntent[]): VaultDepositLine[] {
  return intents
    .map((intent) => {
      const metadata = (intent.metadata as Record<string, unknown>) ?? {};
      const vaultAddress = typeof metadata.vaultAddress === 'string' ? metadata.vaultAddress.trim() : '';
      if (metadata.purchaseMode !== 'ERC4626_DEPOSIT' || !vaultAddress) {
        return null;
      }
      const projectTitle =
        typeof metadata.projectTitle === 'string' ? metadata.projectTitle : intent.id;
      return { intent, vaultAddress, projectTitle };
    })
    .filter((row): row is VaultDepositLine => row !== null);
}

export function CartVaultDepositPanel({
  paymentIntents,
  linkedWalletAddress,
  paymentOptionId,
  disabled = false,
  onComplete,
  onError
}: CartVaultDepositPanelProps) {
  const t = useTranslation();
  const c = t.cartCheckout;
  const w = t.wallet;
  const { address, isConnected, chainId } = useAccount();
  const { buy, status: buyStatus } = useBuyToken();
  const [activeIndex, setActiveIndex] = useState(0);
  const [completedTxHashes, setCompletedTxHashes] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);

  const isWalletConnectFlow = paymentOptionId === 'walletconnect_usdc';
  const lines = useMemo(() => parseVaultLines(paymentIntents), [paymentIntents]);
  const wrongChain = isConnected && chainId != null && chainId !== BASE_CHAIN_ID;
  const walletReady = isWalletConnectFlow
    ? Boolean(isConnected && address && !wrongChain)
    : Boolean(
        isConnected &&
          address &&
          address.toLowerCase() === linkedWalletAddress.toLowerCase() &&
          !wrongChain
      );
  const shareReceiver = linkedWalletAddress as `0x${string}`;

  const runDeposits = useCallback(async () => {
    if (!walletReady || !address || isRunning || lines.length === 0) {
      return;
    }

    setIsRunning(true);
    onError('');

    try {
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (completedTxHashes[line.intent.id]) {
          continue;
        }

        setActiveIndex(index);

        const amountUsd = Number.parseFloat(line.intent.amountUsd).toFixed(6).replace(/\.?0+$/, '') || '0';
        const result = await buy({
          vaultAddress: line.vaultAddress as `0x${string}`,
          usdcAddress: BASE_USDC_ADDRESS,
          amountUsd,
          chainId: line.intent.chainId ?? BASE_CHAIN_ID,
          receiver: shareReceiver
        });

        const verifyResponse = await fetch('/api/payments/usdc/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: line.intent.id,
            txHash: result.depositTxHash,
            walletAddress: address
          })
        });

        const verifyData = (await verifyResponse.json()) as { error?: string };
        if (!verifyResponse.ok) {
          throw new Error(verifyData.error ?? 'USDC_VERIFY_FAILED');
        }

        setCompletedTxHashes((current) => ({
          ...current,
          [line.intent.id]: result.depositTxHash
        }));
      }

      onComplete();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'CART_VAULT_DEPOSIT_FAILED');
    } finally {
      setIsRunning(false);
    }
  }, [address, buy, completedTxHashes, isRunning, lines, onComplete, onError, shareReceiver, walletReady]);

  const allDone = lines.length > 0 && lines.every((line) => completedTxHashes[line.intent.id]);
  const isBusy = isRunning || ['checking', 'approving', 'depositing'].includes(buyStatus);

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-terminal-primary/30 bg-terminal-primary/5 p-4">
      <div>
        <p className="text-sm font-semibold text-terminal-text">{c.vaultDepositTitle}</p>
        <p className="mt-1 text-xs text-terminal-muted">
          {isWalletConnectFlow ? c.walletConnectVaultSubtitle : c.vaultDepositSubtitle}
        </p>
        {isWalletConnectFlow && linkedWalletAddress ? (
          <p className="mt-2 text-xs text-terminal-muted">
            {formatMessage(c.walletConnectTokensToCoinbase, {
              address: `${linkedWalletAddress.slice(0, 6)}…${linkedWalletAddress.slice(-4)}`
            })}
          </p>
        ) : (
          <p className="mt-2 text-xs text-terminal-muted">{w.investorWalletDepositNote}</p>
        )}
      </div>

      <ul className="space-y-2">
        {lines.map((line, index) => {
          const txHash = completedTxHashes[line.intent.id];
          const isActive = isRunning && index === activeIndex;

          return (
            <li
              key={line.intent.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-terminal-text">{line.projectTitle}</p>
                <p className="font-mono text-terminal-muted">
                  {line.intent.tokenCount} tokens · ${Number.parseFloat(line.intent.amountUsd).toFixed(2)} USDC
                </p>
              </div>
              {txHash ? (
                <a
                  href={explorerTxUrl(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-terminal-success"
                >
                  <CheckCircle2 size={14} />
                  <ExternalLink size={12} />
                </a>
              ) : isActive ? (
                <Loader2 size={14} className="shrink-0 animate-spin text-terminal-primary" />
              ) : null}
            </li>
          );
        })}
      </ul>

      {!isConnected || wrongChain ? (
        isWalletConnectFlow ? (
          <WalletConnectConnectButton className="w-full" />
        ) : (
          <CoinbaseConnectButton className="w-full" />
        )
      ) : (
        <button
          type="button"
          disabled={disabled || isBusy || allDone || !walletReady}
          onClick={() => void runDeposits()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          {allDone ? c.vaultDepositDone : isBusy ? w.buyDepositing : c.vaultDepositButton}
        </button>
      )}

      {address ? (
        <p className="text-center text-xs text-terminal-muted">
          {isWalletConnectFlow ? c.walletConnectPayingFrom : w.investorWalletDepositNote}{' '}
          {address.slice(0, 6)}…{address.slice(-4)} · Base
        </p>
      ) : null}
    </div>
  );
}
