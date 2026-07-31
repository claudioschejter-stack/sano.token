'use client';

import { Copy, ExternalLink, Wallet, CheckCircle2, QrCode, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { useMobileWalletDetection } from '../../../hooks/useMobileWalletDetection';
import { usePrivyTreasuryPayment } from '../../../hooks/usePrivyTreasuryPayment';
import { usePrivyEmbeddedWallet } from '../../../hooks/usePrivyEmbeddedWallet';
import type { SimplifiedCryptoWalletMethod } from '../../../lib/payments/checkoutBestRouteService';
import { MobileAppRow } from './MobileAppRow';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';
import type { EnsureCheckoutReference } from './SimplifiedCheckout';

const QR_SIZE = 220;
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || 'https://mainnet.base.org';

function buildEip681Uri(treasuryAddress: string, amountUsdc: number): string {
  const uint256 = Math.round(amountUsdc * 1e6);
  return `ethereum:${USDC_BASE}@8453/transfer?address=${treasuryAddress}&uint256=${uint256}`;
}

function buildCryptoDeepLink(appId: string, treasuryAddress: string, amountUsdc: number): string {
  const eip681 = buildEip681Uri(treasuryAddress, amountUsdc);
  switch (appId) {
    case 'metamask':
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
  mode?: 'deposit' | 'purchase';
  onFunded?: () => void;
  ensureReference?: EnsureCheckoutReference;
};

export function CryptoWalletPanel({
  cryptoWallet,
  treasuryAddress,
  country,
  amountUsd,
  mode = 'deposit',
  onFunded,
  ensureReference
}: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { isDesktop } = useDeviceDetection();
  const { cryptoApps, isMobile, probing } = useMobileWalletDetection(country);
  const { payToTreasury, enabled: privyEnabled } = usePrivyTreasuryPayment();
  const { address: privyAddress, ensureReady, authenticated } = usePrivyEmbeddedWallet();

  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showExternalPay, setShowExternalPay] = useState(false);

  const [depositId, setDepositId] = useState<string | null>(null);
  const [resolvedTreasury, setResolvedTreasury] = useState<string | null>(treasuryAddress);
  const [watchAmountUsdc, setWatchAmountUsdc] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [privyPaying, setPrivyPaying] = useState(false);
  const [privyError, setPrivyError] = useState<string | null>(null);
  const [privyBalanceUsdc, setPrivyBalanceUsdc] = useState<number | null>(null);
  const [checkingWatch, setCheckingWatch] = useState(false);

  const onFundedRef = useRef(onFunded);
  onFundedRef.current = onFunded;

  /** Cart/deposit principal — do not inflate with display-only gas estimate. */
  const amountUsdc = amountUsd;

  const refreshPrivyBalance = useCallback(async (wallet?: string | null) => {
    const addr = wallet?.trim();
    if (!addr) {
      setPrivyBalanceUsdc(null);
      return;
    }
    try {
      const provider = new JsonRpcProvider(BASE_RPC);
      const token = new Contract(USDC_BASE, ['function balanceOf(address) view returns (uint256)'], provider);
      const raw = (await token.balanceOf(addr)) as bigint;
      setPrivyBalanceUsdc(Number(formatUnits(raw, 6)));
      provider.destroy();
    } catch {
      setPrivyBalanceUsdc(null);
    }
  }, []);

  useEffect(() => {
    void refreshPrivyBalance(privyAddress);
  }, [privyAddress, refreshPrivyBalance]);

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

  useEffect(() => {
    let cancelled = false;
    if (!depositId || mode !== 'deposit') return;
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
  }, [depositId, mode]);

  const pollWatchOnce = useCallback(async (): Promise<boolean> => {
    if (!depositId) return false;
    const url =
      mode === 'purchase'
        ? `/api/marketplace/cart/watch?batchId=${encodeURIComponent(depositId)}`
        : `/api/wallet/deposit-intents/watch?id=${encodeURIComponent(depositId)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = (await res.json()) as { deposit?: { status?: string }; allConfirmed?: boolean };
    const ok =
      mode === 'purchase' ? data.allConfirmed === true : data.deposit?.status === 'CONFIRMED';
    if (ok) {
      setConfirmed(true);
      onFundedRef.current?.();
    }
    return ok;
  }, [depositId, mode]);

  useEffect(() => {
    if (!depositId || confirmed) return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      void pollWatchOnce().then(() => undefined).catch(() => undefined);
      if (cancelled) return;
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [depositId, confirmed, pollWatchOnce]);

  const treasuryForQr = resolvedTreasury ?? treasuryAddress;
  const qrAmount = watchAmountUsdc ?? amountUsdc;
  const eip681Uri = treasuryForQr ? buildEip681Uri(treasuryForQr, qrAmount) : null;
  const hasEnoughPrivy =
    privyBalanceUsdc != null && Number.isFinite(privyBalanceUsdc) && privyBalanceUsdc + 1e-9 >= qrAmount;

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

  const handleVerifyNow = async () => {
    setCheckingWatch(true);
    setPrivyError(null);
    try {
      const ok = await pollWatchOnce();
      if (!ok) {
        setPrivyError(sc.cryptoWalletStillWaiting);
      }
    } catch {
      setPrivyError(sc.cryptoWalletStillWaiting);
    } finally {
      setCheckingWatch(false);
    }
  };

  const handlePayWithPrivy = async () => {
    setPrivyError(null);
    setPrivyPaying(true);
    try {
      if (!privyEnabled) {
        throw new Error('PRIVY_NOT_CONFIGURED');
      }
      const payer = await ensureReady();
      await refreshPrivyBalance(payer);

      let referenceId = depositId;
      if (!referenceId && ensureReference) {
        const created = await ensureReference('USDC_ONCHAIN');
        if (!created) {
          throw new Error('CHECKOUT_REFERENCE_FAILED');
        }
        referenceId = created.referenceId;
        setDepositId(created.referenceId);
        if (created.payToAddress) setResolvedTreasury(created.payToAddress);
      }
      if (!referenceId) {
        throw new Error('CHECKOUT_REFERENCE_FAILED');
      }

      const txHash = await payToTreasury({ amountUsd: qrAmount, stablecoinNetwork: 'BASE' });

      if (mode === 'purchase') {
        const response = await fetch('/api/marketplace/cart/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: referenceId,
            txHash,
            walletAddress: payer
          })
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? 'STABLECOIN_VERIFY_FAILED');
        }
      } else {
        const response = await fetch('/api/wallet/deposit-intents/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            depositId: referenceId,
            txHash,
            walletAddress: payer
          })
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? 'STABLECOIN_VERIFY_FAILED');
        }
      }

      setConfirmed(true);
      onFundedRef.current?.();
      void refreshPrivyBalance(payer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PRIVY_PAY_FAILED';
      if (message === 'PRIVY_NOT_CONFIGURED') {
        setPrivyError(sc.cryptoWalletPrivyUnavailable);
      } else if (message.includes('insufficient') || message.includes('INSUFFICIENT')) {
        setPrivyError(sc.cryptoWalletInsufficientPrivy);
      } else {
        setPrivyError(sc.cryptoWalletPrivyPayError.replace('{error}', message));
      }
    } finally {
      setPrivyPaying(false);
    }
  };

  const visibleApps = isMobile ? cryptoApps.filter((a) => a.installed !== false) : [];

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
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

      <div className="rounded-lg border border-terminal-primary/20 bg-terminal-primary/5 px-3 py-2">
        <p className="text-xs font-medium text-terminal-primary">{sc.cryptoWalletNetwork}</p>
      </div>

      {confirmed ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-terminal-success/40 bg-terminal-success/10 px-4 py-6 text-center">
          <CheckCircle2 size={28} className="text-terminal-success" />
          <p className="text-sm font-bold text-terminal-success">{sc.cryptoWalletPaymentReceivedTitle}</p>
          <p className="text-xs text-terminal-muted">{sc.cryptoWalletPaymentReceivedBody}</p>
        </div>
      ) : treasuryForQr ? (
        <>
          {/* ── PRIMARY: pay from Sanova/Privy embedded wallet (no Android app chooser) ── */}
          <div className="space-y-3 rounded-xl border border-terminal-primary/30 bg-terminal-bg/80 p-4">
            <p className="text-xs font-semibold text-terminal-text">{sc.cryptoWalletPrivyTitle}</p>
            <p className="text-[11px] leading-relaxed text-terminal-muted">{sc.cryptoWalletPrivyHint}</p>

            {privyAddress ? (
              <p className="break-all font-mono text-[11px] text-terminal-muted">
                {sc.cryptoWalletPrivyAddress}: {privyAddress}
              </p>
            ) : (
              <p className="text-[11px] text-terminal-muted">
                {authenticated ? sc.cryptoWalletPrivyPreparing : sc.cryptoWalletPrivyLoginHint}
              </p>
            )}

            <div className="flex items-center justify-between rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-xs">
              <span className="text-terminal-muted">{sc.cryptoWalletPrivyBalanceLabel}</span>
              <span className="font-semibold text-terminal-text">
                {privyBalanceUsdc == null ? '…' : `${privyBalanceUsdc.toFixed(2)} USDC`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handlePayWithPrivy()}
              disabled={privyPaying || !privyEnabled}
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
            >
              {privyPaying ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
              {privyPaying
                ? sc.cryptoWalletPrivyPaying
                : sc.cryptoWalletPayFromPrivyButton.replace('{amount}', qrAmount.toFixed(4))}
            </button>

            {privyBalanceUsdc != null && !hasEnoughPrivy ? (
              <p className="text-[11px] leading-relaxed text-amber-600">{sc.cryptoWalletInsufficientPrivy}</p>
            ) : null}

            {privyError ? <p className="text-[11px] leading-relaxed text-red-500">{privyError}</p> : null}
          </div>

          {depositId ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg/60 px-3 py-2 text-[11px] text-terminal-muted">
                <Loader2 size={12} className="animate-spin text-terminal-primary" />
                {sc.cryptoWalletWaitingPayment}
              </div>
              <button
                type="button"
                onClick={() => void handleVerifyNow()}
                disabled={checkingWatch}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-terminal-border bg-terminal-card py-2.5 text-xs font-semibold text-terminal-text disabled:opacity-60"
              >
                {checkingWatch ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {sc.cryptoWalletVerifyNow}
              </button>
            </div>
          ) : null}

          {/* ── SECONDARY: external wallet / Ripio transfer path (collapsed) ── */}
          <div className="rounded-xl border border-dashed border-terminal-border">
            <button
              type="button"
              onClick={() => setShowExternalPay((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-terminal-muted"
            >
              <span>{sc.cryptoWalletOtherWalletTitle}</span>
              {showExternalPay ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showExternalPay && eip681Uri ? (
              <div className="space-y-3 border-t border-terminal-border px-4 pb-4 pt-3">
                <p className="text-[11px] leading-relaxed text-terminal-muted">
                  {sc.cryptoWalletOtherWalletHint}
                </p>

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
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowQr((v) => !v)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-terminal-border bg-terminal-bg py-2.5 text-xs font-semibold text-terminal-muted"
                    >
                      <QrCode size={14} />
                      {showQr ? sc.cryptoWalletHideQr : sc.cryptoWalletShowQr}
                    </button>
                    {showQr ? (
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
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
                    {sc.cryptoWalletAddress}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="break-all font-mono text-xs leading-relaxed text-terminal-text">
                      {treasuryForQr}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyAddr}
                      className="shrink-0 rounded-lg border border-terminal-border bg-terminal-card p-2 text-terminal-muted"
                      title={sc.cryptoWalletCopyAddressTitle}
                    >
                      {copiedAddr ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  {copiedAddr ? (
                    <p className="mt-1.5 text-[11px] font-medium text-terminal-success">{sc.cryptoWalletCopied}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (eip681Uri) window.location.href = eip681Uri;
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-terminal-border bg-terminal-card py-2.5 text-xs font-semibold text-terminal-muted"
                >
                  <ExternalLink size={14} />
                  {sc.cryptoWalletOpenExternalWallet}
                </button>

                <button
                  type="button"
                  onClick={handleCopyUri}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-terminal-border py-2 text-[11px] text-terminal-muted"
                >
                  {copiedUri ? (
                    <>
                      <CheckCircle2 size={12} className="text-green-500" /> {sc.cryptoWalletUriCopied}
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> {sc.cryptoWalletCopyUri}
                    </>
                  )}
                </button>

                {isMobile ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
                      {sc.cryptoWalletDeepLinks}
                    </p>
                    {probing ? (
                      <p className="text-xs text-terminal-muted">{sc.probing}</p>
                    ) : visibleApps.length === 0 ? (
                      <p className="text-xs text-terminal-muted">{sc.cryptoWalletUsePayNowHint}</p>
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
                ) : null}
              </div>
            ) : null}
          </div>
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
        gatewayChargedBy="Base USDC"
        gasChargedBy="Base"
      />
    </section>
  );
}
