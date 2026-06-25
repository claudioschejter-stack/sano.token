'use client';

import { ExternalLink, Loader2 } from 'lucide-react';
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
    throw new Error(`MP preference error: ${res.status}`);
  }
  const data = (await res.json()) as {
    initPoint?: string;
    preferenceId?: string;
    qrData?: string;
  };
  if (!data.initPoint) throw new Error('Missing initPoint in response');
  return {
    initPoint: data.initPoint,
    preferenceId: data.preferenceId ?? '',
    qrData: data.qrData ?? data.initPoint
  };
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
        setMpError(err instanceof Error ? err.message : 'Error desconocido');
      })
      .finally(() => setMpLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceId, fiatWallet.totalUsd]);

  if (!fiatWallet.configured) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  // --- Mercado Pago ---
  if (isMp) {
    return (
      <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{sc.fiatWalletTitle}</h3>
          <p className="mt-1 text-xs text-terminal-muted">{sc.fiatWalletMpHint}</p>
        </div>

        {mpLoading && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-terminal-primary" />
            <span className="text-sm text-terminal-muted">{t.paymentGateway.mpLoading}</span>
          </div>
        )}

        {mpError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {mpError}
          </p>
        )}

        {mpPref && (
          <>
            {isDesktop && (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=10&data=${encodeURIComponent(mpPref.qrData)}`}
                  alt="Mercado Pago QR"
                  width={QR_SIZE}
                  height={QR_SIZE}
                  className="rounded-lg border border-terminal-border bg-white p-2"
                />
              </div>
            )}
            <a
              href={mpPref.initPoint}
              target={isDesktop ? '_blank' : '_self'}
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
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

        {/* Mobile app list for AR */}
        {isMobile && isAR && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">
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
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-terminal-text">{sc.fiatWalletTitle}</h3>
        <p className="mt-1 text-xs text-terminal-muted">{sc.fiatWalletTransakHint}</p>
      </div>

      {isDesktop ? (
        <div className="flex flex-col items-center gap-3">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=10&data=${encodeURIComponent(transakUrl)}`}
            alt="Transak QR"
            width={QR_SIZE}
            height={QR_SIZE}
            className="rounded-lg border border-terminal-border bg-white p-2"
          />
          <a
            href={transakUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs font-medium text-terminal-primary underline-offset-2 hover:underline"
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
            className="h-[580px] w-full rounded-lg border border-terminal-border"
            title="Transak Fiat Wallet"
          />
          {fiatApps.filter((a) => a.installed !== false).length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">
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
