'use client';

import { Loader2, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LocalWalletRail } from '../../lib/payments/localWalletRail';

type RailResponse = {
  ok: boolean;
  country: string;
  reason?: string;
  rail: LocalWalletRail | null;
};

/**
 * One button, whatever country the investor is in.
 *
 * The checkout used to list every provider the catalogue knew about and ask the
 * investor to pick, which is a question they cannot answer: somebody in São
 * Paulo knows they use Nubank, not that Nubank speaks Pix. So the country picks
 * the rail and the button says the name of the thing they already use to pay for
 * coffee — Pix, SPEI, Bre-B.
 */
export function LocalWalletPayButton(props: {
  countryHint?: string | null;
  onSelect: (rail: LocalWalletRail) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<RailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const query = props.countryHint?.trim()
          ? `?country=${encodeURIComponent(props.countryHint.trim())}`
          : '';
        const res = await fetch(`/api/payments/local-wallet-rail${query}`, {
          credentials: 'same-origin',
          cache: 'no-store'
        });
        if (!res.ok || cancelled) return;
        setState((await res.json()) as RailResponse);
      } catch {
        // Leaving `state` null hides the button rather than showing a broken one.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [props.countryHint]);

  if (loading) {
    return (
      <div className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-terminal-border bg-terminal-bg text-xs text-terminal-muted">
        <Loader2 size={14} className="animate-spin" />
      </div>
    );
  }

  // No rail for this country: the other payment methods still apply.
  if (!state?.rail) {
    return null;
  }

  const { rail } = state;

  /**
   * A rail that exists but is switched off is worth naming. Hiding it would look
   * identical to a country we do not serve, and the two need different answers.
   */
  if (!state.ok) {
    return (
      <div className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3 text-xs text-terminal-muted">
        {rail.label} próximamente en tu país.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => props.onSelect(rail)}
      disabled={props.disabled}
      className="inline-flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-terminal-primary px-4 py-3 text-left text-white disabled:opacity-50"
    >
      <span className="flex items-center gap-3">
        <Smartphone size={20} />
        <span>
          <span className="block text-sm font-semibold">Pagar con {rail.label}</span>
          <span className="block text-[11px] font-medium opacity-80">
            Desde tu billetera o tu banco · {rail.settlementHint}
          </span>
        </span>
      </span>
    </button>
  );
}
