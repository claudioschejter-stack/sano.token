'use client';

import { CheckCircle2, ExternalLink, Loader2, QrCode, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { useMobileWalletDetection } from '../../../hooks/useMobileWalletDetection';
import type { SimplifiedFiatWalletMethod } from '../../../lib/payments/checkoutBestRouteService';
import { MobileAppRow } from './MobileAppRow';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';
import type { EnsureCheckoutReference } from './SimplifiedCheckout';

const QR_SIZE = 220;

const PAID_STATUSES = new Set(['processed', 'paid', 'approved']);
const DEAD_STATUSES = new Set(['canceled', 'cancelled', 'expired', 'rejected']);

type DynamicQrState = {
  orderId: string;
  qrData: string | null;
  status: string;
};

type PixPaymentState = {
  paymentId: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  status: string;
};

function formatLocalAmount(amount: number, currency: string): string {
  if (currency === 'ARS' || currency === 'BRL') {
    return `${currency} ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  ensureReference?: EnsureCheckoutReference;
};

export function FiatWalletPanel({
  fiatWallet,
  country,
  amountUsd,
  onFunded,
  ensureReference
}: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { isDesktop } = useDeviceDetection();
  const { fiatApps, isMobile, probing } = useMobileWalletDetection(country);

  const isAR = country === 'AR';
  const isBR = country === 'BR';
  const isMp = fiatWallet.provider === 'mercado_pago';

  const onFundedRef = useRef(onFunded);
  onFundedRef.current = onFunded;
  const createdRef = useRef(false);

  const [confirmed, setConfirmed] = useState(false);

  // ---- Argentina: dynamic Mercado Pago Orders-API QR (interoperable, amount pre-filled) ----
  const [qrOrder, setQrOrder] = useState<DynamicQrState | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAR || !ensureReference || createdRef.current) return;
    createdRef.current = true;
    let cancelled = false;
    setQrLoading(true);
    setQrError(null);

    void (async () => {
      const ref = await ensureReference('LOCAL_RAIL', 'mercadopago_qr');
      if (cancelled) return;
      if (!ref) {
        setQrError(sc.fiatWalletErrorPreparing);
        setQrLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/payments/qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({
            amount: fiatWallet.totalLocal,
            description: 'Fondeo Sanova',
            external_reference: ref.referenceId,
            mode: 'dynamic',
            items: [{ title: 'Fondeo Sanova', unit_price: fiatWallet.totalLocal, quantity: 1 }]
          })
        });
        const data = (await res.json()) as {
          error?: string;
          order?: { orderId: string; qrData: string | null; status: string };
        };
        if (cancelled) return;
        if (!res.ok || !data.order) {
          setQrError(data.error === 'MP_EXTERNAL_POS_ID_NOT_CONFIGURED' ? 'MP_QR_NOT_CONFIGURED' : (data.error ?? 'QR_CREATE_FAILED'));
          setQrLoading(false);
          return;
        }
        setQrOrder({ orderId: data.order.orderId, qrData: data.order.qrData, status: data.order.status });
      } catch {
        if (!cancelled) setQrError('QR_CREATE_FAILED');
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAR, ensureReference]);

  useEffect(() => {
    if (!qrOrder || confirmed) return;
    if (PAID_STATUSES.has(qrOrder.status)) {
      setConfirmed(true);
      onFundedRef.current?.();
      return;
    }
    if (DEAD_STATUSES.has(qrOrder.status)) return;

    const interval = window.setInterval(() => {
      void fetch(`/api/payments/qr/${encodeURIComponent(qrOrder.orderId)}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data: { order?: { orderId: string; qrData: string | null; status: string } }) => {
          if (!data.order) return;
          setQrOrder({ orderId: data.order.orderId, qrData: data.order.qrData, status: data.order.status });
          if (PAID_STATUSES.has(data.order.status)) {
            setConfirmed(true);
            onFundedRef.current?.();
          }
        })
        .catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [qrOrder, confirmed]);

  // ---- Brazil: Pix QR via Mercado Pago Payments API ----
  const [pixPayment, setPixPayment] = useState<PixPaymentState | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  useEffect(() => {
    if (!isBR || !ensureReference || createdRef.current) return;
    createdRef.current = true;
    let cancelled = false;
    setPixLoading(true);
    setPixError(null);

    void (async () => {
      const ref = await ensureReference('LOCAL_RAIL', 'pix');
      if (cancelled) return;
      if (!ref) {
        setPixError(sc.fiatWalletErrorPreparing);
        setPixLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/payments/pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({
            amount: fiatWallet.totalLocal,
            description: 'Fondeo Sanova',
            external_reference: ref.referenceId
          })
        });
        const data = (await res.json()) as {
          error?: string;
          payment?: { paymentId: string; qrCode: string | null; qrCodeBase64: string | null; status: string };
        };
        if (cancelled) return;
        if (!res.ok || !data.payment) {
          setPixError(data.error ?? 'PIX_CREATE_FAILED');
          setPixLoading(false);
          return;
        }
        setPixPayment(data.payment);
      } catch {
        if (!cancelled) setPixError('PIX_CREATE_FAILED');
      } finally {
        if (!cancelled) setPixLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBR, ensureReference]);

  useEffect(() => {
    if (!pixPayment || confirmed) return;
    if (PAID_STATUSES.has(pixPayment.status)) {
      setConfirmed(true);
      onFundedRef.current?.();
      return;
    }
    if (DEAD_STATUSES.has(pixPayment.status)) return;

    const interval = window.setInterval(() => {
      void fetch(`/api/payments/pix/${encodeURIComponent(pixPayment.paymentId)}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data: { payment?: PixPaymentState }) => {
          if (!data.payment) return;
          setPixPayment(data.payment);
          if (PAID_STATUSES.has(data.payment.status)) {
            setConfirmed(true);
            onFundedRef.current?.();
          }
        })
        .catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [pixPayment, confirmed]);

  const handleCopyPix = () => {
    if (!pixPayment?.qrCode) return;
    void navigator.clipboard.writeText(pixPayment.qrCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 1500);
  };

  if (!fiatWallet.configured) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-5">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  const confirmedBanner = (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-terminal-success/40 bg-terminal-success/10 px-4 py-6 text-center">
      <CheckCircle2 size={28} className="text-terminal-success" />
      <p className="text-sm font-bold text-terminal-success">{sc.fiatWalletPaymentReceivedTitle}</p>
      <p className="text-xs text-terminal-muted">{sc.fiatWalletPaymentReceivedBody}</p>
    </div>
  );

  // -------------------------------------------------------------------------
  // Argentina: single dynamic Mercado Pago QR (MODO, Mercado Pago, and other
  // BCRA-interoperable wallets pre-fill the amount when scanning it).
  // -------------------------------------------------------------------------
  if (isMp && isAR) {
    const transakUrl = fiatWallet.widgetUrl;
    const qrNotConfigured = qrError === 'MP_QR_NOT_CONFIGURED' || qrError === 'MP_ACCESS_TOKEN_NOT_CONFIGURED';

    return (
      <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#009EE3]/10 p-2 text-[#009EE3]">
            <QrCode size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-terminal-text">{sc.fiatWalletTitle}</h3>
            <p className="mt-0.5 text-xs text-terminal-muted">MODO · Mercado Pago · Billeteras argentinas</p>
          </div>
        </div>

        {confirmed ? (
          confirmedBanner
        ) : qrLoading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-terminal-primary" />
            <span className="text-sm text-terminal-muted">{sc.fiatWalletGeneratingQr}</span>
          </div>
        ) : qrOrder?.qrData ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-3 py-2.5">
              <p className="text-xs font-semibold text-terminal-primary">{sc.fiatWalletMpInteroperableBadge}</p>
              <p className="mt-0.5 text-[11px] text-terminal-muted">
                {sc.fiatWalletAmountPrefilledNote.replace(
                  '{amount}',
                  formatLocalAmount(fiatWallet.totalLocal, fiatWallet.displayCurrency)
                )}
              </p>
            </div>

            {isMobile ? (
              <div className="space-y-3">
                {(() => {
                  const primaryApp =
                    fiatApps.find((a) => a.installed === true) ??
                    fiatApps.find((a) => a.installed !== false) ??
                    null;
                  return primaryApp ? (
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = primaryApp.deepLink;
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-terminal-primary px-4 py-3.5 text-sm font-semibold text-white"
                    >
                      <Smartphone size={16} />
                      {sc.fiatWalletPayNowCta.replace(
                        '{amount}',
                        formatLocalAmount(fiatWallet.totalLocal, fiatWallet.displayCurrency)
                      )}
                    </button>
                  ) : null;
                })()}

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
                    {sc.fiatWalletAppsTitle}
                  </p>
                  {probing ? (
                    <p className="text-xs text-terminal-muted">{sc.probing}</p>
                  ) : (
                    fiatApps
                      .filter((a) => a.installed !== false)
                      .map((app) => <MobileAppRow key={app.id} app={app} />)
                  )}
                </div>

                <details className="rounded-xl border border-terminal-border bg-terminal-bg p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-terminal-muted">
                    {sc.fiatWalletQrBackup}
                  </summary>
                  <div className="mt-3 flex flex-col items-center gap-3">
                    <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(qrOrder.qrData)}`}
                        alt="QR Mercado Pago"
                        width={QR_SIZE}
                        height={QR_SIZE}
                        className="block rounded"
                      />
                    </div>
                  </div>
                </details>

                <div className="flex items-center justify-center gap-2 text-[11px] text-terminal-muted">
                  <Loader2 size={12} className="animate-spin text-terminal-primary" />
                  {sc.fiatWalletWaitingConfirmation}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-terminal-border bg-terminal-bg p-4">
                  <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(qrOrder.qrData)}`}
                      alt="QR Mercado Pago"
                      width={QR_SIZE}
                      height={QR_SIZE}
                      className="block rounded"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-terminal-muted">
                    <Loader2 size={12} className="animate-spin text-terminal-primary" />
                    {sc.fiatWalletWaitingConfirmation}
                  </div>
                </div>
                <p className="text-center text-[11px] text-terminal-muted">{sc.fiatWalletMpInstructions}</p>
              </div>
            )}
          </div>
        ) : qrNotConfigured ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-900/10 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-400">{sc.fiatWalletQrNotConfiguredTitle}</p>
              <p className="mt-0.5 text-[11px] text-terminal-muted">
                {sc.fiatWalletQrNotConfiguredBodyPrefix}
                <code className="rounded bg-terminal-border/40 px-1 font-mono text-[10px]">MP_EXTERNAL_POS_ID</code>
                {sc.fiatWalletQrNotConfiguredBodySuffix}
              </p>
            </div>
            {transakUrl && (
              <a
                href={transakUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-medium text-terminal-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {sc.fiatWalletPayWithCardMeanwhile}
              </a>
            )}
          </div>
        ) : qrError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2.5">
            <p className="text-xs font-medium text-red-400">{qrError}</p>
          </div>
        ) : null}

        {isMobile && !confirmed && !qrOrder?.qrData ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
              {sc.fiatWalletAppsTitle}
            </p>
            {probing ? (
              <p className="text-xs text-terminal-muted">{sc.probing}</p>
            ) : (
              fiatApps.filter((a) => a.installed !== false).map((app) => <MobileAppRow key={app.id} app={app} />)
            )}
          </div>
        ) : null}

        <PaymentFeeBreakdown
          amountUsd={amountUsd}
          totalUsd={fiatWallet.totalUsd}
          feeBps={fiatWallet.feeBps}
          providerLabel="Mercado Pago"
          gatewayChargedBy="Mercado Pago"
          fxChargedBy="Mercado Pago FX"
        />
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Brazil: single Pix QR (Copia e Cola) via Mercado Pago Payments API.
  // -------------------------------------------------------------------------
  if (isBR) {
    const transakUrl = fiatWallet.widgetUrl;
    const pixNotConfigured = pixError === 'MERCADOPAGO_BR_NOT_CONFIGURED';

    return (
      <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
            <QrCode size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-terminal-text">{sc.fiatWalletTitle}</h3>
            <p className="mt-0.5 text-xs text-terminal-muted">Pix · Bancos e carteiras brasileiras</p>
          </div>
        </div>

        {confirmed ? (
          confirmedBanner
        ) : pixLoading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <span className="text-sm text-terminal-muted">{sc.fiatWalletGeneratingPix}</span>
          </div>
        ) : pixPayment?.qrCodeBase64 ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-xs font-semibold text-emerald-500">{sc.fiatWalletPixBadge}</p>
              <p className="mt-0.5 text-[11px] text-terminal-muted">
                {sc.fiatWalletPixAmountNote.replace(
                  '{amount}',
                  formatLocalAmount(fiatWallet.totalLocal, fiatWallet.displayCurrency)
                )}
              </p>
            </div>

            {isMobile && pixPayment.qrCode ? (
              <button
                type="button"
                onClick={handleCopyPix}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white"
              >
                <Smartphone size={16} />
                {copiedPix
                  ? sc.fiatWalletPixCodeCopied
                  : sc.fiatWalletPayNowCta.replace(
                      '{amount}',
                      formatLocalAmount(fiatWallet.totalLocal, fiatWallet.displayCurrency)
                    )}
              </button>
            ) : null}

            {(isDesktop || !pixPayment.qrCode) && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-terminal-border bg-terminal-bg p-4">
                <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                  <img
                    src={`data:image/png;base64,${pixPayment.qrCodeBase64}`}
                    alt="QR Pix"
                    width={QR_SIZE}
                    height={QR_SIZE}
                    className="block rounded"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-terminal-muted">
                  <Loader2 size={12} className="animate-spin text-emerald-500" />
                  {sc.fiatWalletWaitingConfirmation}
                </div>
              </div>
            )}

            {isMobile && pixPayment.qrCodeBase64 ? (
              <details className="rounded-xl border border-terminal-border bg-terminal-bg p-3">
                <summary className="cursor-pointer text-xs font-semibold text-terminal-muted">
                  {sc.fiatWalletQrBackup}
                </summary>
                <div className="mt-3 flex flex-col items-center gap-3">
                  <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                    <img
                      src={`data:image/png;base64,${pixPayment.qrCodeBase64}`}
                      alt="QR Pix"
                      width={QR_SIZE}
                      height={QR_SIZE}
                      className="block rounded"
                    />
                  </div>
                </div>
              </details>
            ) : null}

            {pixPayment.qrCode && (
              <button
                type="button"
                onClick={handleCopyPix}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-terminal-border bg-transparent py-2 text-[11px] text-terminal-muted transition-colors hover:border-emerald-500 hover:text-emerald-500"
              >
                {copiedPix ? (
                  <>
                    <CheckCircle2 size={12} className="text-green-500" /> {sc.fiatWalletPixCodeCopied}
                  </>
                ) : (
                  sc.fiatWalletPixCopyCode
                )}
              </button>
            )}

            {isMobile ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
                  {sc.fiatWalletAppsTitle}
                </p>
                {probing ? (
                  <p className="text-xs text-terminal-muted">{sc.probing}</p>
                ) : (
                  fiatApps
                    .filter((a) => a.installed !== false)
                    .map((app) => <MobileAppRow key={app.id} app={app} />)
                )}
                <div className="flex items-center justify-center gap-2 text-[11px] text-terminal-muted">
                  <Loader2 size={12} className="animate-spin text-emerald-500" />
                  {sc.fiatWalletWaitingConfirmation}
                </div>
              </div>
            ) : null}
          </div>
        ) : pixNotConfigured ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-900/10 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-400">{sc.fiatWalletPixNotConfiguredTitle}</p>
              <p className="mt-0.5 text-[11px] text-terminal-muted">
                {sc.fiatWalletPixNotConfiguredBody}
              </p>
            </div>
            {transakUrl && (
              <a
                href={transakUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-medium text-terminal-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {sc.fiatWalletPayWithCardMeanwhile}
              </a>
            )}
          </div>
        ) : pixError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2.5">
            <p className="text-xs font-medium text-red-400">{pixError}</p>
          </div>
        ) : null}

        <PaymentFeeBreakdown
          amountUsd={amountUsd}
          totalUsd={fiatWallet.totalUsd}
          feeBps={fiatWallet.feeBps}
          providerLabel="Pix · Mercado Pago"
          gatewayChargedBy="Mercado Pago Pix"
          fxChargedBy="Mercado Pago FX"
        />
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Other countries: Transak fiat widget (unchanged fallback)
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
          <p className="text-[11px] text-terminal-muted">{sc.fiatWalletScanToPay}</p>
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
          <a
            href={transakUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-terminal-primary px-4 py-3 text-sm font-semibold text-white"
          >
            <Smartphone size={16} />
            {sc.fiatWalletPayNowCta.replace(
              '{amount}',
              formatLocalAmount(fiatWallet.totalLocal, fiatWallet.displayCurrency)
            )}
          </a>
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
        gatewayChargedBy="Transak"
        fxChargedBy="Transak"
      />
    </section>
  );
}
