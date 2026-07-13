'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CheckoutSettlementPhase =
  | 'awaiting_payment'
  | 'fiat_paid'
  | 'awaiting_usdc'
  | 'confirmed'
  | 'rwa_delivered'
  | 'failed'
  | 'idle';

type Options = {
  referenceId: string | null;
  mode: 'deposit' | 'purchase';
  enabled?: boolean;
  intervalMs?: number;
};

export function useCheckoutSettlementStatus({
  referenceId,
  mode,
  enabled = true,
  intervalMs = 4000
}: Options) {
  const [phase, setPhase] = useState<CheckoutSettlementPhase>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terminalRef = useRef(false);

  const refresh = useCallback(async (sync = true) => {
    if (!referenceId || !enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        referenceId,
        mode,
        ...(sync ? { sync: '1' } : {})
      });
      const res = await fetch(`/api/payments/checkout-settlement-status?${params}`, {
        cache: 'no-store'
      });
      const data = (await res.json()) as { phase?: CheckoutSettlementPhase; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'STATUS_FAILED');
        return null;
      }
      const next = data.phase ?? 'awaiting_payment';
      setPhase(next);
      const terminal =
        next === 'failed' ||
        (mode === 'deposit' ? next === 'confirmed' || next === 'rwa_delivered' : next === 'rwa_delivered');
      if (terminal) {
        terminalRef.current = true;
      }
      return next;
    } catch {
      setError('STATUS_FAILED');
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, mode, referenceId]);

  useEffect(() => {
    terminalRef.current = false;
    setPhase(referenceId ? 'awaiting_payment' : 'idle');
  }, [referenceId]);

  useEffect(() => {
    if (!referenceId || !enabled) return;
    void refresh(true);
    const id = window.setInterval(() => {
      if (terminalRef.current) return;
      void refresh(true);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, referenceId, refresh]);

  const isComplete =
    mode === 'purchase' ? phase === 'rwa_delivered' : phase === 'confirmed' || phase === 'rwa_delivered';

  return { phase, loading, error, refresh, isComplete };
}
