'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Put a sell offer on the book.
 *
 * The endpoint existed and nothing called it: investors could buy somebody
 * else's offer and cancel their own, but there was no way to create one. A
 * secondary market where nobody can list is a market with one seller, and that
 * seller is the platform.
 */
export function PublishListingForm(props: {
  projectId: string;
  availableToSell: number;
  referencePriceUsd: number;
  labels: {
    title: string;
    tokens: string;
    price: string;
    cta: string;
    publishing: string;
    success: string;
    error: string;
  };
  onPublished: () => void;
}) {
  const [tokenCount, setTokenCount] = useState(1);
  const [price, setPrice] = useState(props.referencePriceUsd);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (props.availableToSell <= 0) {
    return null;
  }

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/secondary-market/listings', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          tokenCount,
          pricePerTokenUsd: price
        })
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage({ kind: 'error', text: body.error ?? props.labels.error });
        return;
      }

      setMessage({ kind: 'ok', text: props.labels.success });
      props.onPublished();
    } catch {
      setMessage({ kind: 'error', text: props.labels.error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">
        {props.labels.title}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-terminal-muted">{props.labels.tokens}</span>
          <input
            type="number"
            min={1}
            max={props.availableToSell}
            value={tokenCount}
            onChange={(event) =>
              setTokenCount(
                Math.min(props.availableToSell, Math.max(1, Math.trunc(Number(event.target.value))))
              )
            }
            className="w-24 rounded-lg border border-terminal-border bg-terminal-card px-2 py-1.5 text-sm text-terminal-text"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-terminal-muted">{props.labels.price}</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={price}
            onChange={(event) => setPrice(Math.max(0.01, Number(event.target.value)))}
            className="w-28 rounded-lg border border-terminal-border bg-terminal-card px-2 py-1.5 text-sm text-terminal-text"
          />
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {busy ? props.labels.publishing : props.labels.cta}
        </button>
      </div>
      {message ? (
        <p
          className={`text-[11px] font-medium ${
            message.kind === 'ok' ? 'text-terminal-success' : 'text-amber-500'
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
