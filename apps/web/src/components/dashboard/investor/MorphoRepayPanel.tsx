'use client';

import { ArrowDownToLine, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useConfig, useSwitchChain } from 'wagmi';
import { useLocale, useTranslation } from '../../../i18n/LocaleProvider';
import { createIntlFormatters } from '../../../i18n/formatters';
import { useLinkedWalletGuard } from '../../../hooks/useLinkedWalletGuard';
import { resolveLendingApiErrorMessage } from '../../../lib/lending/lendingApiErrors';
import { collectionWalletHref } from '../../../lib/navigation/collectionWalletPath';
import { BASE_CHAIN_ID, wagmiConfig } from '../../../lib/web3/config';
import { executePreparedTransactions } from '../../../lib/web3/executePreparedTransactions';
import { pickCoinbaseConnector } from '../../../lib/web3/walletConnectors';

type RepayPosition = {
  projectId: string | null;
  projectTitle: string | null;
  vaultAddress: string;
  marketId: string;
  debtUsd: number;
};

type RepayPreview = {
  chainId: number;
  totalDebtUsd: number;
  positions: RepayPosition[];
  walletAddress: string | null;
};

type MorphoRepayPanelProps = {
  onRepaid?: () => void;
};

export function MorphoRepayPanel({ onRepaid }: MorphoRepayPanelProps) {
  const t = useTranslation();
  const mr = t.cashFlow.morphoRepay;
  const { intlLocale } = useLocale();
  const { formatUsd } = useMemo(() => createIntlFormatters(intlLocale), [intlLocale]);
  const w = t.wallet;
  const walletGuard = useLinkedWalletGuard();
  const router = useRouter();
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();

  const [preview, setPreview] = useState<RepayPreview | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedPosition = preview?.positions.find((row) => row.projectId === selectedProjectId) ?? null;
  const linkedAddress = walletGuard.linkedWallet;
  const connectedAddress = address?.trim().toLowerCase() ?? null;

  const lendingMessages = useMemo(
    () => ({
      walletNotLinked: w.walletNotLinked,
      walletMismatch: w.walletMismatch,
      wrongNetwork: w.wrongNetwork,
      prepareFailed: mr.prepareFailed,
      previewFailed: mr.prepareFailed,
      kycRequired: t.secondaryMarket.kycRequired,
      accountNotOperational: mr.prepareFailed
    }),
    [
      mr.prepareFailed,
      t.secondaryMarket.kycRequired,
      w.walletMismatch,
      w.walletNotLinked,
      w.wrongNetwork
    ]
  );

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/lending/repay-preview', { cache: 'no-store' });
      if (!response.ok) {
        setPreview(null);
        return;
      }

      const payload = (await response.json()) as { preview: RepayPreview };
      setPreview(payload.preview);
      const first = payload.preview.positions[0];
      if (first?.projectId) {
        setSelectedProjectId(first.projectId);
        setAmountUsd(String(first.debtUsd));
      } else {
        setSelectedProjectId('');
        setAmountUsd('');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (selectedPosition) {
      setAmountUsd(String(selectedPosition.debtUsd));
    }
  }, [selectedPosition?.projectId, selectedPosition?.debtUsd]);

  const connectCoinbaseWallet = useCallback(async (): Promise<string | null> => {
    const coinbase = pickCoinbaseConnector(connectors);
    if (!coinbase) {
      setStatus(mr.noWallet);
      return null;
    }

    try {
      const result = await connectAsync({ connector: coinbase, chainId: BASE_CHAIN_ID });
      return result.accounts[0]?.toLowerCase() ?? null;
    } catch {
      setStatus(mr.connectFirst);
      return null;
    }
  }, [connectAsync, connectors, mr.connectFirst, mr.noWallet]);

  async function executeRepay() {
    if (!selectedProjectId || !selectedPosition) {
      setStatus(mr.selectPosition);
      return;
    }

    setBusy(true);
    setStatus(mr.preparing);

    try {
      let activeAddress = connectedAddress;

      if (!isConnected || !activeAddress) {
        activeAddress = (await connectCoinbaseWallet()) ?? null;
      }

      if (!activeAddress) {
        setStatus(mr.connectFirst);
        return;
      }

      if (!walletGuard.isWalletLinked) {
        setStatus(w.walletNotLinked);
        return;
      }

      if (walletGuard.isWalletMismatch) {
        router.push(collectionWalletHref({ returnTo: '/dashboard/cash-flow' }));
        return;
      }

      if (chainId != null && chainId !== BASE_CHAIN_ID) {
        await switchChainAsync({ chainId: BASE_CHAIN_ID });
      } else if (walletGuard.isWrongNetwork) {
        setStatus(w.wrongNetwork);
        return;
      }

      const amount = Number(amountUsd);
      if (!Number.isFinite(amount) || amount <= 0) {
        setStatus(mr.invalidAmount);
        return;
      }

      const response = await fetch('/api/lending/repay-prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          walletAddress: activeAddress,
          amountUsd: amount
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
        txCount === 1
          ? mr.signingSingle
          : mr.signingBatch.replace('{current}', '1').replace('{total}', String(txCount))
      );

      const execution = await executePreparedTransactions(
        config ?? wagmiConfig,
        payload.prepared.chainId,
        payload.prepared.transactions
      );

      setStatus(execution.mode === 'batch' ? mr.success : mr.success);
      await loadPreview();
      onRepaid?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : mr.prepareFailed);
    } finally {
      setBusy(false);
    }
  }

  const displayWallet = connectedAddress ?? linkedAddress;

  if (loading) {
    return (
      <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
        <p className="text-sm text-terminal-muted">{mr.loading}</p>
      </article>
    );
  }

  if (!preview || preview.totalDebtUsd <= 0 || preview.positions.length === 0) {
    return (
      <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
        <h3 className="text-sm font-medium text-terminal-muted">{mr.title}</h3>
        <p className="mt-2 text-sm text-terminal-text">{mr.noDebt}</p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-terminal-border bg-terminal-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-terminal-muted">{mr.title}</p>
          <h2 className="mt-2 font-mono text-3xl font-bold text-terminal-warning sm:text-4xl">
            {formatUsd(preview.totalDebtUsd)}
          </h2>
          <p className="mt-2 text-xs text-terminal-muted">{mr.subtitle}</p>
        </div>
      </div>

      {preview.positions.length > 1 ? (
        <label className="mt-6 block text-sm">
          <span className="text-terminal-muted">{mr.positionLabel}</span>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text"
          >
            {preview.positions.map((row) =>
              row.projectId ? (
                <option key={row.projectId} value={row.projectId}>
                  {row.projectTitle ?? row.projectId} · {formatUsd(row.debtUsd)}
                </option>
              ) : null
            )}
          </select>
        </label>
      ) : selectedPosition ? (
        <p className="mt-6 text-sm text-terminal-muted">
          {mr.positionSingle.replace('{title}', selectedPosition.projectTitle ?? selectedPosition.vaultAddress)}
        </p>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="text-terminal-muted">{mr.amountLabel}</span>
        <div className="mt-1 flex gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amountUsd}
            onChange={(event) => setAmountUsd(event.target.value)}
            className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
          />
          {selectedPosition ? (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-terminal-border px-3 py-2 text-xs font-semibold text-terminal-text hover:border-terminal-primary/40"
              onClick={() => setAmountUsd(String(selectedPosition.debtUsd))}
            >
              {mr.useMax}
            </button>
          ) : null}
        </div>
      </label>

      <button
        type="button"
        onClick={() => void executeRepay()}
        disabled={busy || !selectedProjectId}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowDownToLine size={18} />}
        {busy ? mr.repaying : mr.repayButton}
      </button>

      {displayWallet ? (
        <p className="mt-3 text-xs font-mono text-terminal-muted">
          {displayWallet.slice(0, 6)}…{displayWallet.slice(-4)}
        </p>
      ) : null}

      {status ? <p className="mt-3 text-sm font-medium text-terminal-muted">{status}</p> : null}
    </article>
  );
}
