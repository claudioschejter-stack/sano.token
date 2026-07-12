'use client';

import { Copy, ExternalLink, Wallet, CheckCircle2, QrCode, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { useMobileWalletDetection } from '../../../hooks/useMobileWalletDetection';
import type { SimplifiedCryptoWalletMethod } from '../../../lib/payments/checkoutBestRouteService';
import { MobileAppRow } from './MobileAppRow';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';
import type { EnsureCheckoutReference } from './SimplifiedCheckout';

const QR_SIZE = 220;

/** USDC token contract on Base (chainId 8453) */
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * EIP-681 payment request URI.
 * Encodes: recipient, token (USDC/Base), amount.
 * Compatible with MetaMask, Coinbase Wallet, Rainbow, Trust, imToken, etc.
 */
function buildEip681Uri(treasuryAddress: string, amountUsdc: number): string {
  const uint256 = Math.round(amountUsdc * 1e6); // USDC has 6 decimals
  return `ethereum:${USDC_BASE}@8453/transfer?address=${treasuryAddress}&uint256=${uint256}`;
}

/**
 * App-specific deep links — pre-fill recipient + amount + token.
 * Falls back to the universal EIP-681 URI for unknown apps.
 */
function buildCryptoDeepLink(appId: string, treasuryAddress: string, amountUsdc: number): string {
  const eip681 = buildEip681Uri(treasuryAddress, amountUsdc);
  switch (appId) {
    case 'metamask':
      // MetaMask mobile supports the ethereum: URI scheme directly
      return eip681;
    case 'trust':
      return `trust://send?to=${treasuryAddress}&amount=${amountUsdc}&token=USDC&network=base`;
    case 'coinbase_wallet':
      return `cbwallet://send?to=${treasuryAddress}&amount=${amountUsdc}&asset=USDC&network=base`;
    case 'rainbow':
      return `rainbow://send?to=${treasuryAddress}&amount=${amountUsdc}&currency=USDC&network=base`;
    default:
      return eip681;
  }
}

type Props = {
  cryptoWallet: SimplifiedCryptoWalletMethod;
  treasuryAddress: string | null;
  country: string;
  amountUsd: number;
  onFunded?: () => void;
  ensureReference?: EnsureCheckoutReference;
};

export function CryptoWalletPanel({
  cryptoWallet,
  treasuryAddress,
  country,
  amountUsd,
  onFunded,
  ensureReference
}: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { isDesktop } = useDeviceDetection();
  const { cryptoApps, isMobile, probing } = useMobileWalletDetection(country);

  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const [depositId, setDepositId] = useState<string | null>(null);
  const [resolvedTreasury, setResolvedTreasury] = useState<string | null>(treasuryAddress);
  const [watchAmountUsdc, setWatchAmountUsdc] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const onFundedRef = useRef(onFunded);
  onFundedRef.current = onFunded;

  const amountUsdc = cryptoWallet.totalUsd;

  // Create (or reuse) a real backend deposit for this QR, watermarked with a unique
  // micro-amount so the payment can be detected automatically once it lands on-chain.
  useEffect(() => {
    let cancelled = false;
    if (!ensureReference) return;
    void ensureReference('USDC_ONCHAIN').then((result) => {
      if (cancelled || !result) return;
      setDepositId(result.referenceId);
      if (result.payToAddress) setResolvedTreasury(result.payToAddress);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureReference]);

  // Fetch the watermarked "watch amount" for the created deposit, once available.
  useEffect(() => {
    let cancelled = false;
    if (!depositId) return;
    void fetch(`/api/wallet/deposit-intents?id=${encodeURIComponent(depositId)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { deposit?: { metadata?: { qrWatchAmountUsd?: number | null } | null } }) => {
        if (cancelled) return;
        const watch = data.deposit?.metadata?.qrWatchAmountUsd;
        if (typeof watch === 'number' && Number.isFinite(watch)) {
          setWatchAmountUsdc(watch);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [depositId]);

  // Poll for automatic on-chain payment detection every 5s while the deposit is pending.
  useEffect(() => {
    if (!depositId || confirmed) return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      void fetch(`/api/wallet/deposit-intents/watch?id=${encodeURIComponent(depositId)}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data: { deposit?: { status?: string } }) => {
          if (cancelled) return;
          if (data.deposit?.status === 'CONFIRMED') {
            setConfirmed(true);
            onFundedRef.current?.();
          }
        })
        .catch(() => undefined);
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [depositId, confirmed]);

  const treasuryForQr = resolvedTreasury ?? treasuryAddress;
  const qrAmount = watchAmountUsdc ?? amountUsdc;
  const eip681Uri = treasuryForQr ? buildEip681Uri(treasuryForQr, qrAmount) : null;

  const handleCopyAddr = () => {
    if (!treasuryForQr) return;
    void navigator.clipboard.writeText(treasuryForQr);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1500);
  };

  const handleCopyUri = () => {
    if (!eip681Uri) return;
    void navigator.clipboard.writeText(eip681Uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 1500);
  };

  const handlePayNow = () => {
    if (!eip681Uri) return;
    // On mobile browsers, the ethereum: URI opens the default wallet app
    window.location.href = eip681Uri;
  };

  const visibleApps = isMobile ? cryptoApps.filter((a) => a.installed !== false) : [];

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-terminal-primary/10 p-2 text-terminal-primary">
          <Wallet size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{sc.cryptoWalletTitle}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">
            USDC · Base Network · {amountUsdc.toFixed(2)} USDC
          </p>
        </div>
      </div>

      {/* Amount to pay — prominent */}
      <div className="rounded-xl border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
          {sc.cryptoWalletExactAmountLabel}
        </p>
        <p className="mt-1 text-2xl font-bold text-terminal-primary">
          {qrAmount.toFixed(4)} <span className="text-base font-semibold">USDC</span>
        </p>
        <p className="mt-0.5 text-xs text-terminal-muted">
          {sc.cryptoWalletOnBaseNote}
          {watchAmountUsdc ? sc.cryptoWalletTrackingCentsNote : ''}
        </p>
      </div>

      {/* Network badge */}
      <div className="rounded-lg border border-terminal-primary/20 bg-terminal-primary/5 px-3 py-2">
        <p className="text-xs font-medium text-terminal-primary">{sc.cryptoWalletNetwork}</p>
      </div>

      {confirmed ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-terminal-success/40 bg-terminal-success/10 px-4 py-6 text-center">
          <CheckCircle2 size={28} className="text-terminal-success" />
          <p className="text-sm font-bold text-terminal-success">{sc.cryptoWalletPaymentReceivedTitle}</p>
          <p className="text-xs text-terminal-muted">{sc.cryptoWalletPaymentReceivedBody}</p>
        </div>
      ) : treasuryForQr && eip681Uri ? (
        <>
          {depositId && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg/60 px-3 py-2 text-[11px] text-terminal-muted">
              <Loader2 size={12} className="animate-spin text-terminal-primary" />
              {sc.cryptoWalletWaitingPayment}
            </div>
          )}

          {/* ── PRIMARY ACTION: Pay Now button (mobile) ── */}
          {isMobile && (
            <button
              type="button"
              onClick={handlePayNow}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3.5 text-sm font-bold text-white shadow-lg active:opacity-90"
            >
              <ExternalLink size={16} />
              {sc.cryptoWalletPayNowButton.replace('{amount}', qrAmount.toFixed(4))}
            </button>
          )}

          {/* ── QR code — desktop always visible, mobile toggle ── */}
          {isDesktop ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-terminal-border bg-terminal-bg p-4">
              <p className="text-xs text-terminal-muted">{sc.cryptoWalletQrHint}</p>
              <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(eip681Uri)}`}
                  alt={sc.cryptoWalletQrAlt.replace('{amount}', qrAmount.toFixed(4))}
                  width={QR_SIZE}
                  height={QR_SIZE}
                  className="block rounded"
                />
              </div>
              <p className="text-center text-[11px] text-terminal-muted">
                {sc.cryptoWalletScanHint}
                <br />
                <span className="font-semibold text-terminal-primary">
                  {sc.cryptoWalletAmountPrefillNote.replace('{amount}', qrAmount.toFixed(4))}
                </span>
              </p>
            </div>
          ) : (
            /* Mobile: optional QR (for scanning from a second device) */
            <div>
              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-terminal-border bg-terminal-bg py-2.5 text-xs font-semibold text-terminal-muted"
              >
                <QrCode size={14} />
                {showQr ? sc.cryptoWalletHideQr : sc.cryptoWalletShowQr}
              </button>
              {showQr && (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-terminal-border bg-terminal-bg p-4">
                  <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(eip681Uri)}`}
                      alt={sc.cryptoWalletQrAlt.replace('{amount}', qrAmount.toFixed(4))}
                      width={QR_SIZE}
                      height={QR_SIZE}
                      className="block rounded"
                    />
                  </div>
                  <p className="text-center text-[11px] text-terminal-muted">
                    {sc.cryptoWalletAmountPrefilledShort.replace('{amount}', qrAmount.toFixed(4))}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Address field ── */}
          <div className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
              {sc.cryptoWalletAddress}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="break-all font-mono text-xs text-terminal-text leading-relaxed">
                {treasuryForQr}
              </p>
              <button
                type="button"
                onClick={handleCopyAddr}
                className="shrink-0 rounded-lg border border-terminal-border bg-terminal-card p-2 text-terminal-muted transition-colors hover:border-terminal-primary hover:text-terminal-primary"
                title={sc.cryptoWalletCopyAddressTitle}
              >
                {copiedAddr ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
            {copiedAddr && (
              <p className="mt-1.5 text-[11px] font-medium text-terminal-success">
                {sc.cryptoWalletCopied}
              </p>
            )}
          </div>

          {/* ── Copy EIP-681 URI (power users) ── */}
          <button
            type="button"
            onClick={handleCopyUri}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-terminal-border bg-transparent py-2 text-[11px] text-terminal-muted transition-colors hover:border-terminal-primary hover:text-terminal-primary"
          >
            {copiedUri ? (
              <><CheckCircle2 size={12} className="text-green-500" /> {sc.cryptoWalletUriCopied}</>
            ) : (
              <><Copy size={12} /> {sc.cryptoWalletCopyUri}</>
            )}
          </button>

          {/* ── Mobile wallet deep links ── */}
          {isMobile && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
                {sc.cryptoWalletDeepLinks}
              </p>
              {probing ? (
                <p className="text-xs text-terminal-muted">{sc.probing}</p>
              ) : visibleApps.length === 0 ? (
                <p className="text-xs text-terminal-muted">
                  {sc.cryptoWalletUsePayNowHint}
                </p>
              ) : (
                visibleApps.map((app) => (
                  <MobileAppRow
                    key={app.id}
                    app={app}
                    actionDeepLink={buildCryptoDeepLink(app.id, treasuryForQr, qrAmount)}
                  />
                ))
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-terminal-muted">{sc.notConfigured}</p>
      )}

      <PaymentFeeBreakdown
        amountUsd={amountUsd}
        totalUsd={cryptoWallet.totalUsd}
        feeBps={cryptoWallet.feeBps}
        providerLabel="Base USDC"
        networkFeeUsd={cryptoWallet.networkFeeUsd}
        networkFeeIncluded
      />
    </section>
  );
}
