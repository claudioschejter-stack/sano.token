'use client';

import { CreditCard, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useGlobalRetailOnRamp } from '../../../hooks/useGlobalRetailOnRamp';

type GlobalRetailOnRampPanelProps = {
  amountUsd: number;
  countryCode: string;
  labels: {
    title: string;
    subtitle: string;
    cta: string;
    providers: string;
    loading: string;
  };
  onFunded?: () => void;
  onError?: (message: string) => void;
};

export function GlobalRetailOnRampPanel({
  amountUsd,
  countryCode,
  labels,
  onFunded,
  onError
}: GlobalRetailOnRampPanelProps) {
  const { startOnRamp, privyReady } = useGlobalRetailOnRamp();
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-bg p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-terminal-border bg-terminal-card p-2 text-terminal-primary">
          <CreditCard size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{labels.title}</h3>
          <p className="mt-1 text-xs text-terminal-muted">{labels.subtitle}</p>
          <p className="mt-2 text-[11px] text-terminal-muted">{labels.providers}</p>
        </div>
      </div>

      <button
        type="button"
        disabled={!privyReady || busy || amountUsd <= 0}
        onClick={() => {
          setBusy(true);
          void startOnRamp({ amountUsd, countryCode, preferredProvider: 'stripe' })
            .then(() => onFunded?.())
            .catch((error) => {
              const message = error instanceof Error ? error.message : 'PRIVY_FUND_FAILED';
              if (!message.toLowerCase().includes('closed') && !message.toLowerCase().includes('cancel')) {
                onError?.(message);
              }
            })
            .finally(() => setBusy(false));
        }}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {busy ? labels.loading : labels.cta}
      </button>
    </section>
  );
}
