'use client';

import { ExternalLink, Globe, Loader2, QrCode, Smartphone } from 'lucide-react';
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
    session?: { initPoint?: string; preferenceId?: string };
    initPoint?: string;
    preferenceId?: string;
    qrData?: string;
  };

  const initPoint = data.session?.initPoint ?? data.initPoint;
  const preferenceId = data.session?.preferenceId ?? data.preferenceId ?? '';
  if (!initPoint) throw new Error('No se pudo crear el link de pago. Intentá nuevamente.');

  return { initPoint, preferenceId, qrData: initPoint };
}

function formatLocalAmount(amount: number, currency: string): string {
  if (currency === 'ARS') {
    return `$ ${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ARS`;
  }
  if (currency === 'USD') return `USD ${amount.toFixed(2)}`;
  return `${currency} ${amount.toFixed(2)}`;
}

type Props = {
  fiatWallet: SimplifiedFiatWalletMethod;
  referenceId: string;
  country: string;
  amountUsd: number;
  onFunded?: () => void;
};

export function FiatWalletPanel({
  fiatWallet,
  referenceId,
  country,
  amountUsd,
  onFunded: _
}: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { isDesktop } = useDeviceDetection();
  const { fiatApps, isMobile, probing } = useMobileWalletDetection(country);

  // Tab state: 'universal' shows interoperable/web QR; 'mp' shows MP-native QR
  const [activeTab, setActiveTab] = useState<'universal' | 'mp'>('universal');

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

  // -------------------------------------------------------------------------
  // Argentina: tab-based panel (Universal QR + Mercado Pago tab)
  // -------------------------------------------------------------------------
  if (isMp) {
    const transakUrl = fiatWallet.widgetUrl;
    const staticQrData = fiatWallet.staticQrData;

    return (
      <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#009EE3]/10 p-2 text-[#009EE3]">
            <QrCode size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-terminal-text">{sc.fiatWalletTitle}</h3>
            <p className="mt-0.5 text-xs text-terminal-muted">
              Elegí cómo pagar con tu billetera digital
            </p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-terminal-border bg-terminal-bg p-1">
          <button
            onClick={() => setActiveTab('universal')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'universal'
                ? 'bg-terminal-primary text-white shadow'
                : 'text-terminal-muted hover:text-terminal-text'
            }`}
          >
            <Globe size={12} />
            QR Universal
          </button>
          <button
            onClick={() => setActiveTab('mp')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'mp'
                ? 'bg-[#009EE3] text-white shadow'
                : 'text-terminal-muted hover:text-terminal-text'
            }`}
          >
            <span className="text-[13px] leading-none">💙</span>
            Mercado Pago
          </button>
        </div>

        {/* ---- Universal tab ---- */}
        {activeTab === 'universal' && (
          <div className="space-y-3">
            {staticQrData ? (
              /* ── CASE 1: Admin configured a static interoperable merchant QR ── */
              <>
                <div className="rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-3 py-2.5">
                  <p className="text-xs font-semibold text-terminal-primary">
                    ✓ QR Interoperable — acepta todas las billeteras
                  </p>
                  <p className="mt-0.5 text-[11px] text-terminal-muted">
                    MODO · Brubank · Naranja X · AstroPay · Mercado Pago · Uala · Wise · y más
                  </p>
                </div>

                {isDesktop && (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-terminal-border bg-terminal-bg p-4">
                    <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(staticQrData)}`}
                        alt="QR Universal Interoperable"
                        width={QR_SIZE}
                        height={QR_SIZE}
                        className="block rounded"
                      />
                    </div>
                    <p className="text-center text-[11px] text-terminal-muted">
                      Escaneá con CUALQUIER billetera digital
                    </p>
                  </div>
                )}

                {/* Amount + reference — user must enter these manually */}
                <div className="rounded-lg border border-terminal-border bg-terminal-bg divide-y divide-terminal-border/50">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-terminal-muted">Monto a ingresar</span>
                    <span className="text-sm font-bold text-terminal-text">
                      {formatLocalAmount(fiatWallet.totalLocal, fiatWallet.displayCurrency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-terminal-muted">Referencia / Concepto</span>
                    <span className="font-mono text-xs font-semibold text-terminal-primary">
                      {referenceId}
                    </span>
                  </div>
                </div>

                <p className="text-center text-[11px] text-terminal-muted">
                  {isMobile
                    ? 'Abrí tu billetera · Escaneá · Ingresá el monto y la referencia · Confirmá'
                    : 'Escaneá el QR desde el celular · Ingresá el monto y la referencia · Confirmá'}
                </p>
              </>
            ) : (
              /* ── CASE 2: No static QR configured — show MODO setup guide ── */
              /* NOTE: Transak does NOT work with Argentine digital wallets    */
              /* (MODO, Brubank, Naranja X). It only processes credit cards.  */
              /* The real universal QR for AR requires BCRA interoperability. */
              <div className="space-y-3">
                {/* Pending config notice */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-900/10 px-3 py-2.5">
                  <p className="text-xs font-semibold text-amber-400">
                    ⏳ QR Interoperable no configurado aún
                  </p>
                  <p className="mt-0.5 text-[11px] text-terminal-muted">
                    Una vez configurado, este QR será escaneado directamente por MODO, Brubank, Naranja X, Banco Macro y todas las billeteras argentinas.
                  </p>
                </div>

                {/* Step-by-step MODO setup */}
                <div className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-terminal-text">
                    Cómo activar el QR Universal:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-terminal-muted">
                    <li>
                      Esperá las credenciales de{' '}
                      <a
                        href="https://modo.com.ar/comercios"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-terminal-primary hover:underline"
                      >
                        MODO
                      </a>{' '}
                      (registro ya completado — llega en 72hs)
                    </li>
                    <li>Desde el portal MODO, descargá el QR estático interoperable</li>
                    <li>Leé el contenido del QR con cualquier app lectora de QR</li>
                    <li>
                      En Vercel → Settings → Environment Variables, agregá:
                      <br />
                      <code className="mt-0.5 inline-block rounded bg-terminal-border/40 px-1.5 py-0.5 font-mono text-[10px] text-terminal-primary">
                        FIAT_STATIC_QR_DATA = [contenido del QR]
                      </code>
                    </li>
                    <li>Redesplegá → el QR aparece automáticamente aquí</li>
                  </ol>
                </div>

                {/* Transak card payment fallback — clearly labeled as card, NOT wallet */}
                {transakUrl && (
                  <div className="rounded-lg border border-terminal-border/50 bg-terminal-bg/60 p-3">
                    <p className="mb-2 text-[11px] font-semibold text-terminal-text/70">
                      Mientras tanto — pagar con tarjeta de crédito/débito:
                    </p>
                    {isDesktop ? (
                      <a
                        href={transakUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs font-medium text-terminal-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir formulario de pago con tarjeta (Transak)
                      </a>
                    ) : (
                      <a
                        href={transakUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2.5 text-sm font-semibold text-terminal-primary transition hover:bg-terminal-primary/20"
                      >
                        <Smartphone className="h-4 w-4" />
                        Pagar con tarjeta
                      </a>
                    )}
                    <p className="mt-1.5 text-[10px] text-terminal-muted">
                      Solo tarjeta · No compatible con MODO, Brubank ni otras billeteras
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- Mercado Pago tab ---- */}
        {activeTab === 'mp' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[#009EE3]/20 bg-[#009EE3]/5 px-3 py-2.5">
              <p className="text-xs font-semibold text-[#009EE3]">
                Exclusivo para la app de Mercado Pago
              </p>
              <p className="mt-0.5 text-[11px] text-terminal-muted">
                Otras billeteras (MODO, Brubank, AstroPay, etc.) no reconocen este QR — usá la pestaña Universal.
              </p>
            </div>

            {mpLoading && (
              <div className="flex flex-col items-center gap-3 py-6">
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
                        actionDeepLink={
                          app.id === 'mercadopago' && mpPref ? mpPref.initPoint : undefined
                        }
                      />
                    ))
                )}
              </div>
            )}
          </div>
        )}

        <PaymentFeeBreakdown
          amountUsd={amountUsd}
          totalUsd={fiatWallet.totalUsd}
          feeBps={fiatWallet.feeBps}
          providerLabel="Mercado Pago"
        />
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Non-Argentina: Transak fiat widget
  // -------------------------------------------------------------------------
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
