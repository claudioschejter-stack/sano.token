'use client';

import { Activity, AlertTriangle, Shield } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';

type MorphoHealthPanelProps = {
  projectId: string;
  refreshIntervalMs?: number;
};

type HealthPayload = {
  healthFactor: number;
  borrowCapacityUsd: number;
  debtUsd: number;
  collateralUsd: number;
  lltvRatio: number;
  ready: boolean;
  message?: string;
};

export function MorphoHealthPanel({ projectId, refreshIntervalMs = 30_000 }: MorphoHealthPanelProps) {
  const t = useTranslation();
  const m = t.marketplace.borrow;
  const walletGuard = useLinkedWalletGuard();
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!walletGuard.linkedWallet) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        projectId,
        walletAddress: walletGuard.linkedWallet
      });
      const response = await fetch(`/api/lending/health-factor?${params.toString()}`, {
        credentials: 'same-origin'
      });
      const data = (await response.json()) as { health?: HealthPayload; error?: string };

      if (!response.ok || !data.health) {
        setError(data.error ?? m.prepareFailed);
        return;
      }

      setHealth(data.health);
    } catch {
      setError(m.prepareFailed);
    } finally {
      setBusy(false);
    }
  }, [m.prepareFailed, projectId, walletGuard.linkedWallet]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refresh, refreshIntervalMs]);

  if (!walletGuard.isWalletLinked) {
    return null;
  }

  const hf = health?.healthFactor ?? 0;
  const riskLevel = hf >= 1.5 ? 'safe' : hf >= 1.1 ? 'watch' : 'danger';
  const riskColors = {
    safe: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    watch: 'border-amber-300 bg-amber-50 text-amber-900',
    danger: 'border-red-300 bg-red-50 text-red-900'
  };

  return (
    <section className={`rounded-xl border px-4 py-3 ${health ? riskColors[riskLevel] : 'border-terminal-border bg-terminal-bg'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {riskLevel === 'danger' ? <AlertTriangle size={16} /> : <Shield size={16} />}
          {m.collateralLabel ?? 'Health Factor'}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="text-xs font-medium underline opacity-80 hover:opacity-100 disabled:opacity-50"
        >
          {busy ? '…' : 'Refresh'}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs">{error}</p> : null}

      {health?.ready ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="opacity-70">Health Factor</dt>
            <dd className="text-lg font-bold tabular-nums">
              {Number.isFinite(hf) && hf < 100 ? hf.toFixed(2) : '∞'}
            </dd>
          </div>
          <div>
            <dt className="opacity-70">{m.amountLabel}</dt>
            <dd className="font-semibold tabular-nums">${health.debtUsd.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="opacity-70">{m.collateralLabel ?? 'Collateral'}</dt>
            <dd className="font-semibold tabular-nums">${health.collateralUsd.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="opacity-70">{m.bestRateHint}</dt>
            <dd className="font-semibold tabular-nums">${health.borrowCapacityUsd.toFixed(2)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-xs opacity-80">
          <Activity size={14} className="animate-pulse" />
          {m.prepareFailed}
        </p>
      )}
    </section>
  );
}
