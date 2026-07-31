'use client';

import { Copy, ExternalLink, Wallet, CheckCircle2, QrCode, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { useMobileWalletDetection } from '../../../hooks/useMobileWalletDetection';
import { usePrivyTreasuryPayment } from '../../../hooks/usePrivyTreasuryPayment';
import { usePrivyEmbeddedWallet } from '../../../hooks/usePrivyEmbeddedWallet';
import { usePrivyWalletLink } from '../../../hooks/usePrivyWalletLink';
import type { SimplifiedCryptoWalletMethod } from '../../../lib/payments/checkoutBestRouteService';
import { MobileAppRow } from './MobileAppRow';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';
import type { EnsureCheckoutReference } from './SimplifiedCheckout';

const QR_SIZE = 220;
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || 'https://mainnet.base.org';

function buildEip681Uri(toAddress: string, amountUsdc: number): string {
  const uint256 = Math.round(amountUsdc * 1e6);
  return `ethereum:${USDC_BASE}@8453/transfer?address=${toAddress}&uint256=${uint256}`;
}

function buildCryptoDeepLink(appId: string, toAddress: string, amountUsdc: number): string {
  const eip681 = buildEip681Uri(toAddress, amountUsdc);
  switch (appId) {
    case 'metamask':
      return eip681;
    case 'trust':
      return `trust://send?to=${toAddress}&amount=${amountUsdc}&token=USDC&network=base`;
    case 'coinbase_wallet':
      return `cbwallet://send?to=${toAddress}&amount=${amountUsdc}&asset=USDC&network=base`;
    case 'rainbow':
      return `rainbow://send?to=${toAddress}&amount=${amountUsdc}&currency=USDC&network=base`;
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
  const { linkPrivyWallet } = usePrivyWalletLink();

  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [showQr, setShowQr] = useState(true);
  const [showAdvancedTreasury, setShowAdvancedTreasury] = useState(false);

  const [depositId, setDepositId] = useState<string | null>(null);
  const [resolvedTreasury, setResolvedTreasury] = useState<string | null>(treasuryAddress);
  const [confirmed, setConfirmed] = useState(false);
  const [privyPaying, setPrivyPaying] = useState(false);
  const [privyError, setPrivyError] = useState<string | null>(null);
  const [privyBalanceUsdc, setPrivyBalanceUsdc] = useState<number | null>(null);
  const [inboundDetected, setInboundDetected] = useState(false);
  const [autoSettleStatus, setAutoSettleStatus] = useState<'idle' | 'waiting_funds' | 'settling' | 'done'>(
    'idle'
  );
  const autoSettleStarted = useRef(false);

  const onFundedRef = useRef(onFunded);
  onFundedRef.current = onFunded;

  const amountUsdc = amountUsd;
  const receiveAddress = privyAddress?.trim() || null;

  const refreshPrivyBalance = useCallback(async (wallet?: string | null) => {
    const addr = wallet?.trim();
    if (!addr) {
      setPrivyBalanceUsdc(null);
      return null;
    }
    try {
      const provider = new JsonRpcProvider(BASE_RPC);
      const token = new Contract(USDC_BASE, ['function balanceOf(address) view returns (uint256)'], provider);
      const raw = (await token.balanceOf(addr)) as bigint;
      const balance = Number(formatUnits(raw, 6));
      setPrivyBalanceUsdc(balance);
      provider.destroy();
      return balance;
    } catch {
      setPrivyBalanceUsdc(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshPrivyBalance(privyAddress);
    const id = window.setInterval(() => {
      void refreshPrivyBalance(privyAddress);
    }, 8000);
    return () => window.clearInterval(id);
  }, [privyAddress, refreshPrivyBalance]);

  useEffect(() => {
    let cancelled = false;
    if (!ensureReference || mode !== 'purchase') return;
    void ensureReference('USDC_ONCHAIN').then((result) => {
      if (cancelled || !result) return;
      setDepositId(result.referenceId);
      if (result.payToAddress) setResolvedTreasury(result.payToAddress);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureReference, mode]);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const addr = privyAddress ?? (await ensureReady());
        if (cancelled || !addr) return;
        await linkPrivyWallet().catch(() => undefined);
        await refreshPrivyBalance(addr);
      } catch {
        /* optional bootstrap */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, ensureReady, linkPrivyWallet, privyAddress, refreshPrivyBalance]);

  const hasEnoughPrivy =
    privyBalanceUsdc != null && Number.isFinite(privyBalanceUsdc) && privyBalanceUsdc + 1e-9 >= amountUsdc;

  const settlePurchaseFromPrivy = useCallback(async () => {
    if (mode !== 'purchase') return false;
    if (!privyEnabled) {
      throw new Error('PRIVY_NOT_CONFIGURED');
    }

    const payer = await ensureReady();
    await linkPrivyWallet().catch(() => undefined);
    const balance = await refreshPrivyBalance(payer);
    if (balance == null || balance + 1e-9 < amountUsdc) {
      throw new Error('INSUFFICIENT_PRIVY_USDC');
    }

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

    const txHash = await payToTreasury({ amountUsd: amountUsdc, stablecoinNetwork: 'BASE' });

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

    setConfirmed(true);
    setAutoSettleStatus('done');
    onFundedRef.current?.();
    void refreshPrivyBalance(payer);
    return true;
  }, [
    amountUsdc,
    depositId,
    ensureReady,
    ensureReference,
    linkPrivyWallet,
    mode,
    payToTreasury,
    privyEnabled,
    refreshPrivyBalance
  ]);

  const handlePayWithPrivy = async () => {
    setPrivyError(null);
    setPrivyPaying(true);
    setAutoSettleStatus('settling');
    try {
      if (mode === 'deposit') {
        const payer = await ensureReady();
        await linkPrivyWallet().catch(() => undefined);
        const balance = await refreshPrivyBalance(payer);
        if (balance != null && balance + 1e-9 >= amountUsdc) {
          setConfirmed(true);
          setAutoSettleStatus('done');
          onFundedRef.current?.();
          return;
        }
        throw new Error('INSUFFICIENT_PRIVY_USDC');
      }

      await settlePurchaseFromPrivy();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PRIVY_PAY_FAILED';
      autoSettleStarted.current = false;
      setAutoSettleStatus(hasEnoughPrivy ? 'idle' : 'waiting_funds');
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

  /** Poll personal Privy inbound watcher; auto-settle purchase when balance covers the cart. */
  useEffect(() => {
    if (confirmed) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          balanceUsdc?: number;
          newInbounds?: unknown[];
          readyToAutoSettle?: boolean;
        };
        if (typeof data.balanceUsdc === 'number') {
          setPrivyBalanceUsdc(data.balanceUsdc);
        }
        if (data.newInbounds && data.newInbounds.length > 0) {
          setInboundDetected(true);
        }

        if (mode === 'deposit') {
          if (
            (typeof data.balanceUsdc === 'number' && data.balanceUsdc + 1e-9 >= amountUsdc) ||
            (data.newInbounds && data.newInbounds.length > 0)
          ) {
            setConfirmed(true);
            setAutoSettleStatus('done');
            onFundedRef.current?.();
          }
          return;
        }

        const ready =
          data.readyToAutoSettle ||
          (typeof data.balanceUsdc === 'number' && data.balanceUsdc + 1e-9 >= amountUsdc);

        if (ready && !autoSettleStarted.current && privyEnabled) {
          autoSettleStarted.current = true;
          setAutoSettleStatus('settling');
          setPrivyPaying(true);
          setPrivyError(null);
          try {
            await settlePurchaseFromPrivy();
          } catch (error) {
            autoSettleStarted.current = false;
            setAutoSettleStatus('waiting_funds');
            const message = error instanceof Error ? error.message : 'PRIVY_PAY_FAILED';
            setPrivyError(sc.cryptoWalletPrivyPayError.replace('{error}', message));
          } finally {
            setPrivyPaying(false);
          }
        } else if (!ready) {
          setAutoSettleStatus((prev) => (prev === 'settling' || prev === 'done' ? prev : 'waiting_funds'));
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    void tick();
    const interval = window.setInterval(() => {
      void tick();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [amountUsdc, confirmed, mode, privyEnabled, sc.cryptoWalletPrivyPayError, settlePurchaseFromPrivy]);

  const eip681Uri = receiveAddress ? buildEip681Uri(receiveAddress, amountUsdc) : null;
  const treasuryForAdvanced = resolvedTreasury ?? treasuryAddress;
  const treasuryEip681 = treasuryForAdvanced ? buildEip681Uri(treasuryForAdvanced, amountUsdc) : null;
  const visibleApps = isMobile ? cryptoApps.filter((a) => a.installed !== false) : [];

  const handleCopyAddr = () => {
    if (!receiveAddress) return;
    void navigator.clipboard.writeText(receiveAddress);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1500);
  };

  const handleCopyUri = () => {
    if (!eip681Uri) return;
    void navigator.clipboard.writeText(eip681Uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 1500);
  };

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-terminal-primary/10 p-2 text-terminal-primary">
          <Wallet size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{sc.cryptoWalletTitle}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">
            USDC · Base · {amountUsdc.toFixed(2)} USDC
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
          {mode === 'purchase' ? sc.cryptoWalletExactAmountLabel : sc.cryptoWalletReceiveAmountLabel}
        </p>
        <p className="mt-1 text-2xl font-bold text-terminal-primary">
          {amountUsdc.toFixed(2)} <span className="text-base font-semibold">USDC</span>
        </p>
        <p className="mt-0.5 text-xs text-terminal-muted">{sc.cryptoWalletOnBaseNote}</p>
      </div>

      {confirmed ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-terminal-success/40 bg-terminal-success/10 px-4 py-6 text-center">
          <CheckCircle2 size={28} className="text-terminal-success" />
          <p className="text-sm font-bold text-terminal-success">
            {mode === 'purchase' ? sc.cryptoWalletPaymentReceivedTitle : sc.cryptoWalletDepositReceivedTitle}
          </p>
          <p className="text-xs text-terminal-muted">
            {mode === 'purchase' ? sc.cryptoWalletPaymentReceivedBody : sc.cryptoWalletDepositReceivedBody}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 rounded-xl border border-terminal-primary/30 bg-terminal-bg/80 p-4">
            <p className="text-xs font-semibold text-terminal-text">{sc.cryptoWalletPrivyReceiveTitle}</p>
            <p className="text-[11px] leading-relaxed text-terminal-muted">
              {mode === 'purchase' ? sc.cryptoWalletPrivyReceivePurchaseHint : sc.cryptoWalletPrivyReceiveDepositHint}
            </p>

            {receiveAddress ? (
              <div className="rounded-xl border border-terminal-border bg-terminal-card px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
                  {sc.cryptoWalletPrivyAddress}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="break-all font-mono text-xs leading-relaxed text-terminal-text">{receiveAddress}</p>
                  <button
                    type="button"
                    onClick={handleCopyAddr}
                    className="shrink-0 rounded-lg border border-terminal-border bg-terminal-bg p-2 text-terminal-muted"
                    title={sc.cryptoWalletCopyAddressTitle}
                  >
                    {copiedAddr ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
                {copiedAddr ? (
                  <p className="mt-1.5 text-[11px] font-medium text-terminal-success">{sc.cryptoWalletCopied}</p>
                ) : null}
              </div>
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

            {inboundDetected || autoSettleStatus === 'waiting_funds' ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-[11px] text-terminal-muted">
                <Loader2 size={12} className="animate-spin text-terminal-primary" />
                {mode === 'purchase' ? sc.cryptoWalletAutoSettleWaiting : sc.cryptoWalletWaitingDeposit}
              </div>
            ) : null}

            {autoSettleStatus === 'settling' || privyPaying ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-3 py-2 text-[11px] text-terminal-primary">
                <Loader2 size={12} className="animate-spin" />
                {sc.cryptoWalletAutoSettling}
              </div>
            ) : null}

            {hasEnoughPrivy && mode === 'purchase' ? (
              <button
                type="button"
                onClick={() => void handlePayWithPrivy()}
                disabled={privyPaying || !privyEnabled}
                className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
              >
                {privyPaying ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                {privyPaying
                  ? sc.cryptoWalletPrivyPaying
                  : sc.cryptoWalletPayFromPrivyButton.replace('{amount}', amountUsdc.toFixed(2))}
              </button>
            ) : null}

            {!hasEnoughPrivy && receiveAddress && eip681Uri ? (
              <div className="space-y-3">
                {isDesktop ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-terminal-border bg-terminal-card p-4">
                    <p className="text-xs text-terminal-muted">{sc.cryptoWalletQrHintPrivy}</p>
                    <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(eip681Uri)}`}
                        alt={sc.cryptoWalletQrAlt.replace('{amount}', amountUsdc.toFixed(2))}
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
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-terminal-border bg-terminal-card py-2.5 text-xs font-semibold text-terminal-muted"
                    >
                      <QrCode size={14} />
                      {showQr ? sc.cryptoWalletHideQr : sc.cryptoWalletShowQr}
                    </button>
                    {showQr ? (
                      <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-terminal-border bg-terminal-card p-4">
                        <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(eip681Uri)}`}
                            alt={sc.cryptoWalletQrAlt.replace('{amount}', amountUsdc.toFixed(2))}
                            width={QR_SIZE}
                            height={QR_SIZE}
                            className="block rounded"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

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

                {isMobile && visibleApps.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
                      {sc.cryptoWalletDeepLinks}
                    </p>
                    {probing ? (
                      <p className="text-xs text-terminal-muted">{sc.probing}</p>
                    ) : (
                      visibleApps.map((app) => (
                        <MobileAppRow
                          key={app.id}
                          app={app}
                          actionDeepLink={buildCryptoDeepLink(app.id, receiveAddress, amountUsdc)}
                        />
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {privyError ? <p className="text-[11px] leading-relaxed text-red-500">{privyError}</p> : null}
          </div>

          {treasuryForAdvanced && treasuryEip681 ? (
            <div className="rounded-xl border border-dashed border-terminal-border">
              <button
                type="button"
                onClick={() => setShowAdvancedTreasury((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-terminal-muted"
              >
                <span>{sc.cryptoWalletOtherWalletTitle}</span>
                {showAdvancedTreasury ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showAdvancedTreasury ? (
                <div className="space-y-3 border-t border-terminal-border px-4 pb-4 pt-3">
                  <p className="text-[11px] leading-relaxed text-terminal-muted">
                    {sc.cryptoWalletOtherWalletHint}
                  </p>
                  <div className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
                      {sc.cryptoWalletAddress}
                    </p>
                    <p className="mt-2 break-all font-mono text-xs text-terminal-text">{treasuryForAdvanced}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = treasuryEip681;
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-terminal-border bg-terminal-card py-2.5 text-xs font-semibold text-terminal-muted"
                  >
                    <ExternalLink size={14} />
                    {sc.cryptoWalletOpenExternalWallet}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
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
