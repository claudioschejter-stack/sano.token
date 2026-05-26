'use client';

import { Loader2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { BrowserProvider } from 'ethers';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { BestBorrowRateResponse } from '../../types/marketplace';

type BorrowPanelProps = {
  borrowRate: BestBorrowRateResponse;
  projectId?: string;
  vaultAddress?: string | null;
  readyToBorrow?: boolean;
};

export function BorrowPanel({ borrowRate, projectId, vaultAddress, readyToBorrow = true }: BorrowPanelProps) {
  const m = useTranslation().marketplace.borrow;
  const [amountUsd, setAmountUsd] = useState('1000');
  const [collateralEth, setCollateralEth] = useState('0.1');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus(m.noWallet);
      return;
    }

    const provider = new BrowserProvider(window.ethereum);
    const accounts = (await provider.send('eth_requestAccounts', [])) as string[];
    setWalletAddress(accounts[0] ?? null);
    setStatus(m.walletConnected);
  }

  async function executeBorrow() {
    if (!walletAddress) {
      setStatus(m.connectFirst);
      return;
    }

    if (!readyToBorrow || !projectId || !vaultAddress) {
      setStatus('Este activo todavía no está listo para préstamo colateralizado.');
      return;
    }

    setBusy(true);
    setStatus(m.preparing);

    try {
      const response = await fetch('/api/lending/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: Number(amountUsd),
          collateralEth: Number(collateralEth),
          walletAddress,
          projectId,
          vaultAddress,
          preferProtocol: 'morpho'
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

      for (const [index, tx] of payload.prepared.transactions.entries()) {
        setStatus(m.signingStep.replace('{step}', String(index + 1)));
        const sent = await signer.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: BigInt(tx.value)
        });
        await sent.wait();
      }

      setStatus(m.success);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : m.prepareFailed);
    } finally {
      setBusy(false);
    }
  }

  const bestApy = (borrowRate.best.borrowApyBps / 100).toFixed(2);

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
      <div className="border-b border-terminal-border px-4 py-4 md:px-6">
        <h2 className="text-lg font-bold text-terminal-text">{m.title}</h2>
        <p className="mt-1 text-sm text-terminal-muted">{m.subtitle}</p>
        <p className="mt-2 text-xs text-terminal-muted">
          {m.bestRateHint}: <span className="font-mono text-terminal-primary">{bestApy}% APY</span> ·{' '}
          {borrowRate.best.name}
        </p>
      </div>

      <div className="grid gap-4 px-4 py-5 md:grid-cols-2 md:px-6">
        <label className="block text-sm">
          <span className="text-terminal-muted">{m.amountLabel}</span>
          <input
            type="number"
            min="1"
            step="1"
            value={amountUsd}
            onChange={(event) => setAmountUsd(event.target.value)}
            className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
          />
        </label>
        <label className="block text-sm">
          <span className="text-terminal-muted">{m.collateralLabel}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={collateralEth}
            onChange={(event) => setCollateralEth(event.target.value)}
            className="mt-1 w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-terminal-border px-4 py-4 md:px-6">
        <button
          type="button"
          onClick={() => void connectWallet()}
          className="inline-flex items-center gap-2 rounded-lg border border-terminal-border px-4 py-2 text-sm font-semibold text-terminal-text hover:border-terminal-primary/40"
        >
          <Wallet size={16} />
          {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : m.connectWallet}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void executeBorrow()}
          className="inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {readyToBorrow ? m.borrowButton : 'Préstamo no listo'}
        </button>
      </div>

      {status ? <p className="border-t border-terminal-border px-4 py-3 text-xs text-terminal-muted md:px-6">{status}</p> : null}
      <p className="border-t border-terminal-border px-4 py-3 text-xs text-terminal-muted md:px-6">{m.disclaimer}</p>
    </section>
  );
}
