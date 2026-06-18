'use client';

import { Loader2, TrendingUp, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import { usePrivyEmbeddedWallet } from '../../hooks/usePrivyEmbeddedWallet';
import { executePreparedTransactionsWithWalletClient } from '../../lib/web3/executeWithWalletClient';
import { MorphoHealthPanel } from '../lending/MorphoHealthPanel';

type LeveragedCheckoutPanelProps = {
  projectId: string;
  amountUsd: number;
  cartBatchId?: string | null;
  onComplete?: (result: { hashes: string[] }) => void;
  onError?: (message: string) => void;
};

export function LeveragedCheckoutPanel({
  projectId,
  amountUsd,
  cartBatchId,
  onComplete,
  onError
}: LeveragedCheckoutPanelProps) {
  const t = useTranslation();
  const m = t.marketplace.borrow;
  const walletGuard = useLinkedWalletGuard();
  const { createEmbeddedWalletClient, enabled: privyEnabled } = usePrivyEmbeddedWallet();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const executeLeveragedPurchase = useCallback(async () => {
    if (!walletGuard.linkedWallet) {
      onError?.(m.connectFirst);
      return;
    }

    setBusy(true);
    setStatus('Preparing borrow + purchase…');

    try {
      const response = await fetch('/api/marketplace/cart/leveraged-checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          amountUsd,
          walletAddress: walletGuard.linkedWallet,
          cartBatchId
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        prepared?: { transactions: Array<{ to: string; data: string; value?: string }> };
      };

      if (!response.ok || !payload.prepared?.transactions.length) {
        onError?.(payload.error ?? m.prepareFailed);
        return;
      }

      setStatus('Executing on Base…');

      let hashes: `0x${string}`[];

      if (privyEnabled && walletGuard.linkedWalletProvider?.toLowerCase().includes('privy')) {
        const walletClient = await createEmbeddedWalletClient();
        const result = await executePreparedTransactionsWithWalletClient(
          walletClient,
          payload.prepared.transactions.map((tx) => ({
            to: tx.to,
            data: tx.data,
            value: tx.value ?? '0'
          }))
        );
        hashes = result.hashes;
      } else {
        onError?.('Link your Privy wallet for one-click leveraged purchase.');
        return;
      }

      setStatus('Borrow complete. Confirming shares…');
      onComplete?.({ hashes: [...hashes] });
    } catch {
      onError?.(m.prepareFailed);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }, [
    amountUsd,
    cartBatchId,
    createEmbeddedWalletClient,
    m,
    onComplete,
    onError,
    privyEnabled,
    projectId,
    walletGuard.linkedWallet,
    walletGuard.linkedWalletProvider
  ]);

  return (
    <div className="space-y-4 rounded-xl border border-terminal-primary/30 bg-terminal-primary/5 p-4">
      <div className="flex items-start gap-3">
        <TrendingUp className="mt-0.5 text-terminal-primary" size={20} />
        <div>
          <p className="text-sm font-semibold text-terminal-text">Borrow to buy with Morpho</p>
          <p className="mt-1 text-xs text-terminal-muted">
            One flow: borrow USDC against your vault collateral, pay treasury, receive RWA shares.
          </p>
        </div>
      </div>

      <MorphoHealthPanel projectId={projectId} />

      <button
        type="button"
        disabled={busy || !walletGuard.canSignOnChain}
        onClick={() => void executeLeveragedPurchase()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
        {status ?? `Borrow $${amountUsd.toFixed(0)} USDC & buy`}
      </button>
    </div>
  );
}
