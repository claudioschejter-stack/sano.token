'use client';

import { Loader2, QrCode, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MercadoPagoCheckoutSession } from '../../../lib/checkout/paymentRouteTypes';
import { MercadoPagoQrCode } from './MercadoPagoQrCode';

const MOBILE_DEEP_LINK_FALLBACK_MS = 1500;

type MercadoPagoDirectCheckoutProps = {
  amountUsd: number;
  referenceId: string;
  isMobile: boolean;
  labels: {
    title: string;
    desktopHint: string;
    mobileHint: string;
    loading: string;
    error: string;
    amountLocal: string;
    openApp: string;
  };
  onError?: (message: string) => void;
};

type CheckoutApiResponse =
  | { ok: true; session: MercadoPagoCheckoutSession }
  | { ok?: false; error?: string };

function resolveCheckoutError(payload: CheckoutApiResponse, fallback: string): string {
  if ('error' in payload && payload.error) {
    return payload.error;
  }
  return fallback;
}

export function MercadoPagoDirectCheckout({
  amountUsd,
  referenceId,
  isMobile,
  labels,
  onError
}: MercadoPagoDirectCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<MercadoPagoCheckoutSession | null>(null);

  const launchMobileCheckout = useCallback((nextSession: MercadoPagoCheckoutSession) => {
    window.location.href = `mercadopago://web/checkout?pref_id=${encodeURIComponent(nextSession.preferenceId)}`;
    window.setTimeout(() => {
      window.location.href = nextSession.initPoint;
    }, MOBILE_DEEP_LINK_FALLBACK_MS);
  }, []);

  const createPreference = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/checkout/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd,
          referenceId
        })
      });

      const payload = (await response.json()) as CheckoutApiResponse;
      if (!response.ok || !payload.ok || !('session' in payload) || !payload.session) {
        throw new Error(resolveCheckoutError(payload, labels.error));
      }

      setSession(payload.session);

      if (isMobile) {
        launchMobileCheckout(payload.session);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : labels.error;
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }, [amountUsd, isMobile, labels.error, launchMobileCheckout, onError, referenceId]);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || session) {
      return;
    }
    startedRef.current = true;
    void createPreference();
  }, [createPreference, session]);

  if (!session) {
    return (
      <div className="rounded-xl border border-terminal-border bg-terminal-bg p-4">
        <p className="text-sm font-semibold text-terminal-text">{labels.title}</p>
        <p className="mt-1 text-xs text-terminal-muted">
          {isMobile ? labels.mobileHint : labels.desktopHint}
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => void createPreference()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#009EE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : isMobile ? <Smartphone size={16} /> : <QrCode size={16} />}
          {isMobile ? labels.openApp : labels.title}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-terminal-border bg-terminal-bg p-4">
      <div>
        <p className="text-sm font-semibold text-terminal-text">{labels.title}</p>
        <p className="mt-1 text-xs text-terminal-muted">
          {labels.amountLocal
            .replace('{amount}', session.amountLocal.toLocaleString('es-AR'))
            .replace('{currency}', session.localCurrency)}
        </p>
      </div>

      {!isMobile ? (
        <MercadoPagoQrCode value={session.initPoint} label={labels.desktopHint} />
      ) : (
        <p className="text-xs text-terminal-muted">{labels.mobileHint}</p>
      )}
    </div>
  );
}
