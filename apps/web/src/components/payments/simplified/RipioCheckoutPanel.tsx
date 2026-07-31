'use client';

import { ExternalLink, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { EnsureCheckoutReference } from './SimplifiedCheckout';

type Props = {
  amountUsd: number;
  ensureReference?: EnsureCheckoutReference;
  onFunded?: () => void;
};

export function RipioCheckoutPanel({ amountUsd, ensureReference, onFunded }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!ensureReference) {
      setLoading(false);
      setError(sc.ripioNotConfigured);
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const ref = await ensureReference('RIPIO');
        if (cancelled) return;
        if (!ref?.referenceId) {
          setError(sc.ripioNotConfigured);
          return;
        }
        setReferenceId(ref.referenceId);
        if (ref.providerCheckoutUrl) {
          setCheckoutUrl(ref.providerCheckoutUrl);
        } else {
          setError(sc.ripioNotConfigured);
        }
      } catch {
        if (!cancelled) setError(sc.ripioNotConfigured);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureReference, sc.ripioNotConfigured]);

  useEffect(() => {
    if (!referenceId) return;
    const interval = window.setInterval(() => {
      void fetch(`/api/marketplace/cart/watch?batchId=${encodeURIComponent(referenceId)}`, {
        cache: 'no-store'
      })
        .then((res) => res.json())
        .then((data: { allConfirmed?: boolean }) => {
          if (data.allConfirmed) onFunded?.();
        })
        .catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [onFunded, referenceId]);

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
      <div>
        <h3 className="text-sm font-semibold text-terminal-text">{sc.ripioPanelTitle}</h3>
        <p className="mt-1 text-xs text-terminal-muted">{sc.ripioPanelHint}</p>
        <p className="mt-2 text-xs font-medium text-terminal-primary">
          {amountUsd.toFixed(2)} USDC
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-terminal-muted">
          <Loader2 size={14} className="animate-spin" />
          {sc.ripioPreparing}
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      {checkoutUrl ? (
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3 text-sm font-bold text-white"
        >
          <ExternalLink size={16} />
          {sc.ripioOpenCheckout}
        </a>
      ) : null}
    </section>
  );
}
