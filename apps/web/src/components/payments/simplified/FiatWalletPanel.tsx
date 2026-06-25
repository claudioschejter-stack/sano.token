'use client';

import { ExternalLink, Loader2, QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { useMobileWalletDetection } from '../../../hooks/useMobileWalletDetection';
import type { SimplifiedFiatWalletMethod } from '../../../lib/payments/checkoutBestRouteService';
import { MobileAppRow } from './MobileAppRow';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';

const QR_SIZE = 220;

type MpPreferenceResult = {
  initPoint: string;
  preferenceId: string;
  qrData: string;
};

async function fetchMpPreference(params: {
  amountUsd: number;
  referenceId: string;
}): Promise<MpPreferenceResult> {
  const res = await fetch('/api/checkout/mercadopago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Error ${res.status}`);
  }
  const data = (await res.json()) as {
    ok?: boolean;
    /** New shape: { ok: true, session: { initPoint, preferenceId } } */
    session?: { initPoint?: string; preferenceId?: string };
    /** Legacy flat shape (fallback) */
    initPoint?: string;
    preferenceId?: string;
    qrData?: string;
  };

  const initPoint = data.session?.initPoint ?? data.initPoint;
  const preferenceId = data.session?.preferenceId ?? data.preferenceId ?? '';
  if (!initPoint) throw new Error('No se pudo crear el link de pago. Intentá nuevamente.');

  return { initPoint, preferenceId, qrData: initPoint };
}

type Props = {
  fiatWallet: SimplifiedFiatWalletMethod;
  referenceId: string;
  country: string;
  amountUsd: number;
  onFunded?: () => void;
};

export function FiatWalletPanel({ fiatWallet, referenceId, country, amountUsd, onFunded: _ }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { isDesktop } = useDeviceDetection();
  const { fiatApps, isMobile, probing } = useMobileWalletDetection(country);

  const [mpPref, setMpPref] = useState<MpPreferenceResult | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);

  const isAR = country === 'AR';
  const isMp = fiatWallet.provider === 'mercado_pago';

  useEffect(() => {
    if (!isMp) return;
    setMpLoading(true);
    setMpError(null);
    fetchMpPreference({ amountUsd: fiatWallet.totalUsd, referenceId })
      .then(setMpPref)
      .catch((err: unknown) => {
        setMpError(err instanceof Error ? err.message : 'Error al generar el QR');
      })
      .finally(() => setMpLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceId, fiatWallet.totalUsd]);

  if (!fiatWallet.configured) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-5">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  // --- Mercado Pago ---
  if (isMp) {
    return (
      <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#009EE3]/10 p-2 text-[#009EE3]">
            <QrCode size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-terminal-text">{sc.fiatWalletTitle}</h3>
            <p className="mt-0.5 text-xs text-terminal-muted">{sc.fiatWalletMpHint}</p>
          </div>
        </div>

        {mpLoading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-terminal-primary" />
            <span className="text-sm text-terminal-muted">{t.paymentGateway.mpLoading}</span>
          </div>
        )}

        {mpError && (
          <div className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2.5">
            <p className="text-xs font-medium text-red-400">{mpError}</p>
          </div>
        )}

        {mpPref && !mpLoading && (
          <>
            {isDesktop && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-terminal-border bg-terminal-bg p-4">
                <p className="text-xs text-terminal-muted">{sc.fiatWalletMpHint}</p>
                <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(mpPref.qrData)}`}
                    alt="Mercado Pago QR"
                    width={QR_SIZE}
                    height={QR_SIZE}
                    className="block rounded"
                  />
                </div>
                <p className="text-[11px] text-terminal-muted">
                  Abrí Mercado Pago · Escaneá · Confirmá el pago
                </p>
              </div>
            )}
            <a
              href={mpPref.initPoint}
              target={isDesktop ? '_blank' : '_self'}
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] px-4 py-3.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
            >
              {t.paymentGateway.mpOpenApp}
              <ExternalLink className="h-4 w-4" />
            </a>
          </>
        )}

        <PaymentFeeBreakdown
          amountUsd={amountUsd}
          totalUsd={fiatWallet.totalUsd}
          feeBps={fiatWallet.feeBps}
          providerLabel="Mercado Pago"
        />

        {isMobile && isAR && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
              {sc.fiatWalletAppsTitle}
            </p>
            {probing ? (
              <p className="text-xs text-terminal-muted">{sc.probing}</p>
            ) : (
              fiatApps
                .filter((a) => a.installed !== false)
                .map((app) => (
                  <MobileAppRow
                    key={app.id}
                    app={app}
                    actionDeepLink={app.id === 'mercadopago' && mpPref ? mpPref.initPoint : undefined}
                  />
                ))
            )}
          </div>
        )}
      </section>
    );
  }

  // --- Transak fiat widget ---
  const transakUrl = fiatWallet.widgetUrl;
  if (!transakUrl) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-5">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-terminal-primary/10 p-2 text-terminal-primary">
          <QrCode size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{sc.fiatWalletTitle}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">{sc.fiatWalletTransakHint}</p>
        </div>
      </div>

      {isDesktop ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-terminal-border bg-terminal-bg p-4">
          <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(transakUrl)}`}
              alt="Transak QR"
              width={QR_SIZE}
              height={QR_SIZE}
              className="block rounded"
            />
          </div>
          <p className="text-[11px] text-terminal-muted">
            Escaneá con tu billetera digital para pagar
          </p>
          <a
            href={transakUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-terminal-primary hover:underline"
          >
            {sc.fiatWalletOpenWeb}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <>
          <iframe
            src={transakUrl}
            allow="camera; microphone; payment"
            className="h-[580px] w-full rounded-xl border border-terminal-border"
            title="Transak Fiat Wallet"
          />
          {fiatApps.filter((a) => a.installed !== false).length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
                {sc.fiatWalletAppsTitle}
              </p>
              {fiatApps
                .filter((a) => a.installed !== false)
                .map((app) => (
                  <MobileAppRow key={app.id} app={app} />
                ))}
            </div>
          )}
        </>
      )}

      <PaymentFeeBreakdown
        amountUsd={amountUsd}
        totalUsd={fiatWallet.totalUsd}
        feeBps={fiatWallet.feeBps}
        providerLabel="Transak"
      />
    </section>
  );
}
