'use client';

import { Loader2, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useConfig, useSwitchChain } from 'wagmi';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import type { BestBorrowRateResponse } from '../../types/marketplace';
import { BASE_CHAIN_ID, wagmiConfig } from '../../lib/web3/config';
import { pickCoinbaseConnector } from '../../lib/web3/walletConnectors';
import {
  resolveBorrowPreviewErrorMessage,
  resolveLendingApiErrorMessage
} from '../../lib/lending/lendingApiErrors';
import { executePreparedTransactions } from '../../lib/web3/executePreparedTransactions';

const MORPHO_PROTOCOL_ID = 'morpho';

type BorrowPanelProps = {
  borrowRate: BestBorrowRateResponse;
  projectId?: string;
  vaultAddress?: string | null;
  readyToBorrow?: boolean;
};

type BorrowPreview = {
  maxBorrowUsd: number;
  suggestedBorrowUsd: number;
  ready: boolean;
  message?: string;
};

export function BorrowPanel({ borrowRate, projectId, vaultAddress, readyToBorrow = false }: BorrowPanelProps) {
  const t = useTranslation();
  const m = t.marketplace.borrow;
  const w = t.wallet;
  const walletGuard = useLinkedWalletGuard();
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const isMorphoRwa = Boolean(projectId && vaultAddress && readyToBorrow);

  const executableQuotes = useMemo(
    () => borrowRate.quotes.filter((quote) => quote.id === MORPHO_PROTOCOL_ID),
    [borrowRate.quotes]
  );

  const morphoQuote = executableQuotes[0];
  const defaultProtocol = isMorphoRwa && morphoQuote ? MORPHO_PROTOCOL_ID : MORPHO_PROTOCOL_ID;

  const [selectedProtocol, setSelectedProtocol] = useState(defaultProtocol);
  const [amountUsd, setAmountUsd] = useState('1000');
  const [preview, setPreview] = useState<BorrowPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isMorphoSelected = isMorphoRwa;
  const selectedQuote =
    executableQuotes.find((quote) => quote.id === selectedProtocol) ?? executableQuotes[0];

  const linkedAddress = walletGuard.linkedWallet;
  const connectedAddress = address?.trim().toLowerCase() ?? null;

  const lendingMessages = useMemo(
    () => ({
      walletNotLinked: w.walletNotLinked,
      walletMismatch: w.walletMismatch,
      wrongNetwork: w.wrongNetwork,
      prepareFailed: m.prepareFailed,
      previewFailed: m.prepareFailed,
      kycRequired: t.secondaryMarket.kycRequired,
      accountNotOperational: m.notReady
    }),
    [m.notReady, m.prepareFailed, t.secondaryMarket.kycRequired, w.walletMismatch, w.walletNotLinked, w.wrongNetwork]
  );

  useEffect(() => {
    if (!executableQuotes.some((quote) => quote.id === selectedProtocol)) {
      setSelectedProtocol(defaultProtocol);
    }
  }, [defaultProtocol, executableQuotes, selectedProtocol]);

  const connectCoinbaseWallet = useCallback(async (): Promise<string | null> => {
    const coinbase = pickCoinbaseConnector(connectors);
    if (!coinbase) {
      setStatus(m.noWallet);
      return null;
    }

    try {
      const result = await connectAsync({ connector: coinbase, chainId: BASE_CHAIN_ID });
      return result.accounts[0] ?? null;
    } catch {
      setStatus(m.connectFirst);
      return null;
    }
  }, [connectAsync, connectors, m.connectFirst, m.noWallet]);

  const refreshPreview = useCallback(
    async (wallet: string, options?: { amountUsd?: number; syncSuggestedAmount?: boolean }) => {
      if (!isMorphoRwa || !projectId) {
        setPreview(null);
        return;
      }

      const parsedAmount = options?.amountUsd ?? Number(amountUsd);
      const response = await fetch('/api/lending/borrow-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          walletAddress: wallet,
          amountUsd: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined
        })
      });

      const payload = (await response.json()) as { preview?: BorrowPreview; error?: string };

      if (!response.ok) {
        setPreview(null);
        setStatus(resolveBorrowPreviewErrorMessage(payload.error, lendingMessages));
        return;
      }

      if (!payload.preview) {
        setPreview(null);
        return;
      }

      setPreview(payload.preview);
      if (options?.syncSuggestedAmount && payload.preview.suggestedBorrowUsd > 0) {
        setAmountUsd(String(Math.floor(payload.preview.suggestedBorrowUsd)));
      }
    },
    [amountUsd, isMorphoRwa, lendingMessages, projectId]
  );

  useEffect(() => {
    if (!isMorphoRwa || !linkedAddress) {
      return;
    }

    if (connectedAddress && connectedAddress === linkedAddress) {
      void refreshPreview(linkedAddress, { syncSuggestedAmount: true });
    }
  }, [connectedAddress, isMorphoRwa, linkedAddress, refreshPreview]);

  useEffect(() => {
    if (!isMorphoRwa || !linkedAddress) {
      return;
    }

    if (!connectedAddress || connectedAddress !== linkedAddress) {
      return;
    }

    const parsed = Number(amountUsd);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshPreview(linkedAddress, { amountUsd: parsed });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [amountUsd, connectedAddress, isMorphoRwa, linkedAddress, refreshPreview]);

  async function executeBorrow() {
    setBusy(true);
    setStatus(m.preparing);

    try {
      let activeAddress = connectedAddress;

      if (!isConnected || !activeAddress) {
        activeAddress = (await connectCoinbaseWallet())?.toLowerCase() ?? null;
      }

      if (!activeAddress) {
        setStatus(m.connectFirst);
        return;
      }

      if (!walletGuard.isWalletLinked) {
        setStatus(w.walletNotLinked);
        return;
      }

      if (walletGuard.isWalletMismatch) {
        setStatus(w.walletMismatch);
        return;
      }

      if (chainId != null && chainId !== BASE_CHAIN_ID) {
        await switchChainAsync({ chainId: BASE_CHAIN_ID });
      } else if (walletGuard.isWrongNetwork) {
        setStatus(w.wrongNetwork);
        return;
      }

      if (isMorphoSelected) {
        if (!readyToBorrow || !projectId || !vaultAddress) {
          setStatus(m.notReady);
          return;
        }
      }

      const response = await fetch('/api/lending/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: Number(amountUsd),
          walletAddress: activeAddress,
          projectId,
          vaultAddress
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        prepared?: {
          chainId: number;
          transactions: Array<{ to: string; data: string; value: string; description: string }>;
        };
      };

      if (!response.ok || !payload.prepared) {
        setStatus(resolveLendingApiErrorMessage(payload.error, lendingMessages));
        return;
      }

      const txCount = payload.prepared.transactions.length;
      setStatus(
        txCount === 1 ? m.signingSingle : m.signingBatch.replace('{current}', '1').replace('{total}', String(txCount))
      );

      const execution = await executePreparedTransactions(
        config ?? wagmiConfig,
        payload.prepared.chainId,
        payload.prepared.transactions
      );

      setStatus(execution.mode === 'batch' ? m.successBatch : m.success);
      await refreshPreview(activeAddress, { amountUsd: Number(amountUsd) });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : m.prepareFailed);
    } finally {
      setBusy(false);
    }
  }

  const bestApy = selectedQuote ? (selectedQuote.borrowApyBps / 100).toFixed(2) : '—';
  const canExecute = Number(amountUsd) > 0 && isMorphoRwa && readyToBorrow;
  const displayWallet = connectedAddress ?? linkedAddress;

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
      <div className="border-b border-terminal-border px-4 py-4 md:px-6">
        <h2 className="text-lg font-bold text-terminal-text">{m.title}</h2>
        <p className="mt-1 text-sm text-terminal-muted">
          {isMorphoSelected ? m.subtitleMorpho : m.subtitle}
        </p>
        {selectedQuote ? (
          <p className="mt-2 text-xs text-terminal-muted">
            {m.bestRateHint}:{' '}
            <span className="font-mono text-terminal-primary">
              {bestApy}% APY · {selectedQuote.name}
            </span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 px-4 py-5 md:grid-cols-2 md:px-6">
        <label className="block text-sm md:col-span-2">
          <span className="text-terminal-muted">{m.amountLabel}</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min="1"
              step="1"
              value={amountUsd}
              onChange={(event) => setAmountUsd(event.target.value)}
              className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
            />
            {preview?.maxBorrowUsd ? (
              <button
                type="button"
                className="shrink-0 rounded-lg border border-terminal-border px-3 py-2 text-xs font-semibold text-terminal-text hover:border-terminal-primary/40"
                onClick={() => setAmountUsd(String(Math.floor(preview.maxBorrowUsd)))}
              >
                {m.useMax}
              </button>
            ) : null}
          </div>
        </label>

        {preview ? (
          <p className="text-xs text-terminal-muted md:col-span-2">
            {preview.ready
              ? m.previewReady.replace('{max}', String(preview.maxBorrowUsd))
              : (preview.message ?? m.previewEmpty)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-terminal-border px-4 py-4 md:px-6">
        <button
          type="button"
          disabled={busy || !canExecute}
          onClick={() => void executeBorrow()}
          className="inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          {canExecute ? m.oneClickBorrow : m.notReadyButton}
        </button>
        {displayWallet ? (
          <span className="text-xs font-mono text-terminal-muted">
            {displayWallet.slice(0, 6)}…{displayWallet.slice(-4)}
          </span>
        ) : null}
      </div>

      {status ? (
        <p className="border-t border-terminal-border px-4 py-3 text-xs text-terminal-muted md:px-6">{status}</p>
      ) : null}
      <p className="border-t border-terminal-border px-4 py-3 text-xs text-terminal-muted md:px-6">
        {m.disclaimerMorpho}
      </p>
    </section>
  );
}
