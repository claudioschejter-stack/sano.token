'use client';

import { CheckCircle2, Copy, Loader2, ShoppingBag, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { usePrivyEmbeddedWallet } from '../../hooks/usePrivyEmbeddedWallet';
import { usePrivyWalletLink } from '../../hooks/usePrivyWalletLink';

type WatchPayload = {
  address?: string | null;
  balanceUsdc?: number;
  newInbounds?: unknown[];
  readyToAutoSettle?: boolean;
  pendingPurchase?: { batchId: string; amountUsd: number } | null;
};

export function PrivyReceiveUsdcCard() {
  const t = useTranslation();
  const w = t.platformWallet;
  const { address, ensureReady, authenticated } = usePrivyEmbeddedWallet();
  const { linkPrivyWallet } = usePrivyWalletLink();

  const [receiveAddress, setReceiveAddress] = useState<string | null>(address ?? null);
  const [balanceUsdc, setBalanceUsdc] = useState<number | null>(null);
  const [detected, setDetected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (authenticated) {
          const ready = address ?? (await ensureReady());
          if (!cancelled && ready) {
            setReceiveAddress(ready);
            await linkPrivyWallet().catch(() => undefined);
          }
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, authenticated, ensureReady, linkPrivyWallet]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as WatchPayload;
        if (typeof data.address === 'string' && data.address.trim()) {
          setReceiveAddress(data.address);
        }
        if (typeof data.balanceUsdc === 'number') {
          setBalanceUsdc(data.balanceUsdc);
        }
        if (data.newInbounds && data.newInbounds.length > 0) {
          setDetected(true);
        }
        if (data.pendingPurchase?.batchId) {
          setPendingBatchId(data.pendingPurchase.batchId);
        } else {
          setPendingBatchId(null);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const handleCopy = () => {
    if (!receiveAddress) return;
    void navigator.clipboard.writeText(receiveAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="space-y-4 rounded-xl border border-terminal-primary/30 bg-terminal-card p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-terminal-primary/10 p-2 text-terminal-primary">
          <Wallet size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{w.receiveUsdcTitle}</h3>
          <p className="mt-1 text-xs leading-relaxed text-terminal-muted">{w.receiveUsdcSubtitle}</p>
          <p className="mt-1 text-[11px] font-medium text-terminal-muted">{w.receiveUsdcNetwork}</p>
        </div>
      </div>

      {loading && !receiveAddress ? (
        <div className="flex items-center gap-2 text-xs text-terminal-muted">
          <Loader2 size={14} className="animate-spin" />
          {w.loading}
        </div>
      ) : receiveAddress ? (
        <div className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="break-all font-mono text-xs leading-relaxed text-terminal-text">{receiveAddress}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-terminal-border bg-terminal-card p-2 text-terminal-muted"
              title={w.receiveUsdcCopy}
            >
              {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>
          {copied ? <p className="mt-1.5 text-[11px] font-medium text-terminal-success">{w.receiveUsdcCopied}</p> : null}
        </div>
      ) : (
        <p className="text-xs text-terminal-muted">{w.receiveUsdcNoWallet}</p>
      )}

      <div className="flex items-center justify-between rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs">
        <span className="text-terminal-muted">{w.receiveUsdcBalanceLabel}</span>
        <span className="font-semibold text-terminal-text">
          {balanceUsdc == null ? '…' : `${balanceUsdc.toFixed(2)} USDC`}
        </span>
      </div>

      {detected ? (
        <div className="flex items-center gap-2 rounded-lg border border-terminal-success/40 bg-terminal-success/10 px-3 py-2 text-xs text-terminal-success">
          <CheckCircle2 size={14} />
          {w.receiveUsdcDetected}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-[11px] text-terminal-muted">
          <Loader2 size={12} className="animate-spin text-terminal-primary" />
          {w.receiveUsdcWaiting}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/marketplace"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-terminal-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          <ShoppingBag size={16} />
          {w.receiveUsdcInvestCta}
        </Link>
        {pendingBatchId ? (
          <Link
            href={`/marketplace/carrito?batchId=${encodeURIComponent(pendingBatchId)}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2.5 text-sm font-semibold text-terminal-primary"
          >
            {w.buyTokens}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
