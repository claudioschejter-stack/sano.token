'use client';

import { Loader2, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserProvider } from 'ethers';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { BestBorrowRateResponse } from '../../types/marketplace';

const EXECUTABLE_PROTOCOL_IDS = new Set(['aave', 'morpho', 'moonwell', 'compound', 'spark']);

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

export function BorrowPanel({ borrowRate, projectId, vaultAddress, readyToBorrow = true }: BorrowPanelProps) {
  const m = useTranslation().marketplace.borrow;
  const isMorphoRwa = Boolean(projectId && vaultAddress && readyToBorrow);

  const executableQuotes = useMemo(
    () => borrowRate.quotes.filter((quote) => EXECUTABLE_PROTOCOL_IDS.has(quote.id)),
    [borrowRate.quotes]
  );

  const morphoQuote = executableQuotes.find((quote) => quote.id === 'morpho');
  const defaultProtocol =
    isMorphoRwa && morphoQuote ? 'morpho' : (executableQuotes[0]?.id ?? 'aave');

  const [selectedProtocol, setSelectedProtocol] = useState(defaultProtocol);
  const [amountUsd, setAmountUsd] = useState('1000');
  const [collateralEth, setCollateralEth] = useState('0.1');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [preview, setPreview] = useState<BorrowPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isMorphoSelected = selectedProtocol === 'morpho' && isMorphoRwa;
  const selectedQuote =
    executableQuotes.find((quote) => quote.id === selectedProtocol) ?? executableQuotes[0];

  useEffect(() => {
    if (!executableQuotes.some((quote) => quote.id === selectedProtocol)) {
      setSelectedProtocol(defaultProtocol);
    }
  }, [defaultProtocol, executableQuotes, selectedProtocol]);

  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (!window.ethereum) {
      setStatus(m.noWallet);
      return null;
    }

    const provider = new BrowserProvider(window.ethereum);
    const accounts = (await provider.send('eth_requestAccounts', [])) as string[];
    const address = accounts[0] ?? null;
    setWalletAddress(address);
    return address;
  }, [m.noWallet]);

  const loadPreview = useCallback(
    async (address: string) => {
      if (!isMorphoRwa || !projectId || selectedProtocol !== 'morpho') {
        setPreview(null);
        return;
      }

      const response = await fetch('/api/lending/borrow-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          walletAddress: address,
          amountUsd: Number(amountUsd) > 0 ? Number(amountUsd) : undefined
        })
      });

      if (!response.ok) {
        setPreview(null);
        return;
      }

      const payload = (await response.json()) as { preview: BorrowPreview };
      setPreview(payload.preview);
      if (payload.preview.suggestedBorrowUsd > 0) {
        setAmountUsd(String(Math.floor(payload.preview.suggestedBorrowUsd)));
      }
    },
    [amountUsd, isMorphoRwa, projectId, selectedProtocol]
  );

  useEffect(() => {
    if (!window.ethereum || !isMorphoRwa || selectedProtocol !== 'morpho') {
      return;
    }

    void (async () => {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = (await provider.send('eth_accounts', [])) as string[];
      const address = accounts[0];
      if (address) {
        setWalletAddress(address);
        await loadPreview(address);
      }
    })();
  }, [isMorphoRwa, loadPreview, selectedProtocol]);

  async function executeBorrow() {
    setBusy(true);
    setStatus(m.preparing);

    try {
      let address = walletAddress;
      if (!address) {
        address = await connectWallet();
      }
      if (!address) {
        setStatus(m.connectFirst);
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
          collateralEth: isMorphoSelected ? undefined : Number(collateralEth),
          walletAddress: address,
          projectId: isMorphoSelected ? projectId : undefined,
          vaultAddress: isMorphoSelected ? vaultAddress : undefined,
          preferProtocol: selectedProtocol
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
        setStatus(payload.error ?? m.prepareFailed);
        return;
      }

      const provider = new BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== payload.prepared.chainId) {
        await window.ethereum!.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${payload.prepared.chainId.toString(16)}` }]
        });
      }

      const total = payload.prepared.transactions.length;
      for (const [index, tx] of payload.prepared.transactions.entries()) {
        setStatus(
          total === 1
            ? m.signingSingle
            : m.signingBatch.replace('{current}', String(index + 1)).replace('{total}', String(total))
        );
        const sent = await signer.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: BigInt(tx.value)
        });
        await sent.wait();
      }

      setStatus(m.success);
      if (isMorphoSelected) {
        await loadPreview(address);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : m.prepareFailed);
    } finally {
      setBusy(false);
    }
  }

  const bestApy = selectedQuote ? (selectedQuote.borrowApyBps / 100).toFixed(2) : '—';
  const canExecute =
    Number(amountUsd) > 0 &&
    (isMorphoSelected ? readyToBorrow : selectedProtocol !== 'morpho' || !isMorphoRwa);

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
        {executableQuotes.length > 1 ? (
          <label className="block text-sm md:col-span-2">
            <span className="text-terminal-muted">{m.protocolLabel}</span>
            <select
              value={selectedProtocol}
              onChange={(event) => setSelectedProtocol(event.target.value)}
              className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text"
            >
              {executableQuotes.map((quote) => (
                <option key={quote.id} value={quote.id} disabled={quote.id === 'morpho' && !isMorphoRwa}>
                  {quote.name} ({(quote.borrowApyBps / 100).toFixed(2)}% APY)
                  {quote.id === 'morpho' && !isMorphoRwa ? ` — ${m.morphoRequiresRwa}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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

        {!isMorphoSelected ? (
          <label className="block text-sm md:col-span-2">
            <span className="text-terminal-muted">{m.collateralLabel}</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={collateralEth}
              onChange={(event) => setCollateralEth(event.target.value)}
              className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
            />
          </label>
        ) : null}

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
        {walletAddress ? (
          <span className="text-xs font-mono text-terminal-muted">
            {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
          </span>
        ) : null}
      </div>

      {status ? (
        <p className="border-t border-terminal-border px-4 py-3 text-xs text-terminal-muted md:px-6">{status}</p>
      ) : null}
      <p className="border-t border-terminal-border px-4 py-3 text-xs text-terminal-muted md:px-6">
        {isMorphoSelected ? m.disclaimerMorpho : m.disclaimerWeth}
      </p>
    </section>
  );
}
