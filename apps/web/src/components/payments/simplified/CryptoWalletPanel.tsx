'use client';

import { Copy, Wallet, CheckCircle2, QrCode, Loader2 } from 'lucide-react';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { resolveDisplayReceiveAddress } from '../../../lib/investor/canonicalReceiveAddress';
import type { SimplifiedCryptoWalletMethod } from '../../../lib/payments/checkoutBestRouteService';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';
import type { EnsureCheckoutReference } from './SimplifiedCheckout';

const QR_SIZE = 220;
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
/** Require this many consecutive low-balance reads before dropping out of "ready to pay". */
const LOW_BALANCE_CONFIRMATIONS = 2;
/** After a hard settle failure, do not auto-retry (stops Pagar ↔ Pagando flicker). */
const SETTLE_AUTO_RETRY_COOLDOWN_MS = 60_000;

function buildEip681Uri(toAddress: string, amountUsdc: number): string {
  const uint256 = Math.round(amountUsdc * 1e6);
  return `ethereum:${USDC_BASE}@8453/transfer?address=${toAddress}&uint256=${uint256}`;
}

function normalizeAddress(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

/**
 * Crypto checkout — server-canonical receive address + server auto-settle.
 * Never opens Privy login / client signing for purchases.
 * Balance UI is sticky: transient RPC failures must not flip pay ↔ deposit screens.
 */
export function CryptoWalletPanel({
  cryptoWallet,
  amountUsd,
  mode = 'deposit',
  onFunded,
  ensureReference
}: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { isDesktop } = useDeviceDetection();

  const [copiedAddr, setCopiedAddr] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [balanceUsdc, setBalanceUsdc] = useState<number | null>(null);
  const [requiredUsdc, setRequiredUsdc] = useState(amountUsd);
  const [serverAddress, setServerAddress] = useState<string | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(true);
  const [fundsReady, setFundsReady] = useState(false);
  const [autoSettleStatus, setAutoSettleStatus] = useState<'idle' | 'waiting_funds' | 'settling' | 'done'>(
    'idle'
  );
  const settleStarted = useRef(false);
  const settleCooldownUntil = useRef(0);
  const lowBalanceStreak = useRef(0);
  const lastKnownBalance = useRef<number | null>(null);

  const onFundedRef = useRef(onFunded);
  onFundedRef.current = onFunded;

  const amountUsdc = requiredUsdc > 0 ? requiredUsdc : amountUsd;
  const receiveAddress = normalizeAddress(
    resolveDisplayReceiveAddress({
      serverLinkedAddress: serverAddress,
      privyClientAddress: null
    })
  );

  const applyBalance = useCallback(
    (next: number | null, known: boolean) => {
      if (!known || next == null || !Number.isFinite(next)) {
        // Keep last known balance on transient RPC failures — never flash 0.
        if (lastKnownBalance.current != null) {
          setBalanceUsdc(lastKnownBalance.current);
        }
        return;
      }

      lastKnownBalance.current = next;
      setBalanceUsdc(next);

      const enough = next + 1e-9 >= amountUsdc;
      if (enough) {
        lowBalanceStreak.current = 0;
        setFundsReady(true);
        return;
      }

      lowBalanceStreak.current += 1;
      if (lowBalanceStreak.current >= LOW_BALANCE_CONFIRMATIONS) {
        setFundsReady(false);
      }
    },
    [amountUsdc]
  );

  const refreshBalanceRpc = useCallback(
    async (wallet?: string | null) => {
      const addr = wallet?.trim();
      if (!addr) return null;
      try {
        const provider = new JsonRpcProvider(BASE_RPC);
        const token = new Contract(USDC_BASE, ['function balanceOf(address) view returns (uint256)'], provider);
        const raw = (await token.balanceOf(addr)) as bigint;
        const balance = Number(formatUnits(raw, 6));
        provider.destroy();
        if (Number.isFinite(balance)) {
          applyBalance(balance, true);
          return balance;
        }
        applyBalance(null, false);
        return null;
      } catch {
        applyBalance(null, false);
        return null;
      }
    },
    [applyBalance]
  );

  const resolveServerAddress = useCallback(async () => {
    setResolvingAddress(true);
    try {
      await fetch('/api/investor/wallet/provision', {
        method: 'POST',
        credentials: 'same-origin'
      }).catch(() => undefined);

      const watchRes = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
      if (watchRes.ok) {
        const watchData = (await watchRes.json()) as {
          address?: string | null;
          balanceUsdc?: number | null;
          balanceKnown?: boolean;
          pendingPurchase?: { amountUsd?: number } | null;
        };
        const fromWatch = normalizeAddress(watchData.address);
        if (fromWatch) {
          setServerAddress(fromWatch);
          if (
            watchData.pendingPurchase &&
            typeof watchData.pendingPurchase.amountUsd === 'number' &&
            watchData.pendingPurchase.amountUsd > 0
          ) {
            setRequiredUsdc(watchData.pendingPurchase.amountUsd);
          }
          if (watchData.balanceKnown === false) {
            await refreshBalanceRpc(fromWatch);
          } else if (typeof watchData.balanceUsdc === 'number') {
            applyBalance(watchData.balanceUsdc, true);
          } else {
            await refreshBalanceRpc(fromWatch);
          }
          return fromWatch;
        }
      }

      const provisionRes = await fetch('/api/investor/wallet/provision', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const provisionData = (await provisionRes.json()) as { walletAddress?: string };
      const fromProvision = normalizeAddress(provisionData.walletAddress);
      if (provisionRes.ok && fromProvision) {
        setServerAddress(fromProvision);
        await refreshBalanceRpc(fromProvision);
        return fromProvision;
      }
      return null;
    } catch {
      return null;
    } finally {
      setResolvingAddress(false);
    }
  }, [applyBalance, refreshBalanceRpc]);

  useEffect(() => {
    void resolveServerAddress();
  }, [resolveServerAddress]);

  useEffect(() => {
    setRequiredUsdc((prev) => (prev > 0 ? prev : amountUsd));
  }, [amountUsd]);

  useEffect(() => {
    if (!ensureReference || mode !== 'purchase') return;
    void ensureReference('USDC_ONCHAIN');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureReference, mode]);

  const mapSettleError = useCallback(
    (errorCode: string) => {
      if (errorCode === 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED') {
        return sc.cryptoWalletAutoSettleNotConfigured;
      }
      if (errorCode === 'USDC_BALANCE_READ_FAILED' || errorCode === 'RPC_BALANCE_READ_FAILED') {
        return sc.cryptoWalletAutoSettleBalanceReadFailed;
      }
      return sc.cryptoWalletAutoSettleError.replace('{error}', errorCode);
    },
    [
      sc.cryptoWalletAutoSettleBalanceReadFailed,
      sc.cryptoWalletAutoSettleError,
      sc.cryptoWalletAutoSettleNotConfigured
    ]
  );

  const triggerServerSettle = useCallback(async () => {
    if (mode !== 'purchase' || confirmed) return false;
    setAutoSettleStatus('settling');
    setSettleError(null);
    try {
      const res = await fetch('/api/wallet/privy-inbound/settle', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: string;
        error?: string;
        amountUsd?: number;
        balanceUsdc?: number;
      };

      if (typeof data.amountUsd === 'number' && data.amountUsd > 0) {
        setRequiredUsdc(data.amountUsd);
      }
      if (typeof data.balanceUsdc === 'number') {
        applyBalance(data.balanceUsdc, true);
      }

      if (res.ok && data.ok && data.status === 'settled') {
        setConfirmed(true);
        setAutoSettleStatus('done');
        settleCooldownUntil.current = 0;
        onFundedRef.current?.();
        return true;
      }

      if (data.status === 'waiting_funds' || data.status === 'no_pending_purchase') {
        setAutoSettleStatus('waiting_funds');
        settleStarted.current = false;
        return false;
      }

      // Hard failure: keep Pagar visible, block auto-retry so UI does not flicker.
      settleStarted.current = false;
      settleCooldownUntil.current = Date.now() + SETTLE_AUTO_RETRY_COOLDOWN_MS;
      setAutoSettleStatus('idle');
      setFundsReady(true);
      if (data.error === 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED' || data.status === 'not_configured') {
        setSettleError(mapSettleError('PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED'));
      } else {
        setSettleError(mapSettleError(data.error ?? data.status ?? 'FAILED'));
      }
      return false;
    } catch (error) {
      settleStarted.current = false;
      settleCooldownUntil.current = Date.now() + SETTLE_AUTO_RETRY_COOLDOWN_MS;
      setAutoSettleStatus('idle');
      setFundsReady(true);
      const message = error instanceof Error ? error.message : 'FAILED';
      setSettleError(mapSettleError(message));
      return false;
    }
  }, [applyBalance, confirmed, mapSettleError, mode]);

  const triggerServerSettleRef = useRef(triggerServerSettle);
  triggerServerSettleRef.current = triggerServerSettle;
  const amountUsdcRef = useRef(amountUsdc);
  amountUsdcRef.current = amountUsdc;

  // Single poller via watch API (RPC fallback only when balanceKnown=false).
  useEffect(() => {
    if (confirmed) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          address?: string | null;
          balanceUsdc?: number | null;
          balanceKnown?: boolean;
          readyToAutoSettle?: boolean;
          newInbounds?: unknown[];
          pendingPurchase?: { amountUsd?: number } | null;
        };
        const watched = normalizeAddress(data.address);
        if (watched) setServerAddress(watched);
        if (
          data.pendingPurchase &&
          typeof data.pendingPurchase.amountUsd === 'number' &&
          data.pendingPurchase.amountUsd > 0
        ) {
          setRequiredUsdc(data.pendingPurchase.amountUsd);
        }

        if (data.balanceKnown === false) {
          await refreshBalanceRpc(watched);
        } else if (typeof data.balanceUsdc === 'number') {
          applyBalance(data.balanceUsdc, true);
        }

        const need = amountUsdcRef.current;

        if (mode === 'deposit') {
          const bal = lastKnownBalance.current;
          if (
            (bal != null && bal + 1e-9 >= need) ||
            (data.newInbounds && data.newInbounds.length > 0)
          ) {
            setConfirmed(true);
            setAutoSettleStatus('done');
            onFundedRef.current?.();
          } else {
            setAutoSettleStatus((prev) => (prev === 'done' ? prev : 'waiting_funds'));
          }
          return;
        }

        const ready =
          data.readyToAutoSettle ||
          (lastKnownBalance.current != null && lastKnownBalance.current + 1e-9 >= need);

        if (ready) {
          setFundsReady(true);
        }

        const canAutoSettle =
          ready && !settleStarted.current && Date.now() >= settleCooldownUntil.current;

        if (canAutoSettle) {
          settleStarted.current = true;
          await triggerServerSettleRef.current();
        } else if (!ready) {
          setAutoSettleStatus((prev) => (prev === 'settling' || prev === 'done' ? prev : 'waiting_funds'));
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [applyBalance, confirmed, mode, refreshBalanceRpc]);

  const eip681Uri = receiveAddress ? buildEip681Uri(receiveAddress, amountUsdc) : null;

  const handleCopyAddr = () => {
    if (!receiveAddress) return;
    void navigator.clipboard.writeText(receiveAddress);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1500);
  };

  const addressBlock = receiveAddress ? (
    <div className="rounded-xl border border-terminal-border bg-terminal-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
        {sc.cryptoWalletSanovaAddressLabel}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="break-all font-mono text-xs leading-relaxed text-terminal-text">{receiveAddress}</p>
        <button
          type="button"
          onClick={handleCopyAddr}
          className="shrink-0 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs font-semibold text-terminal-primary"
          title={sc.cryptoWalletCopyAddressTitle}
        >
          {copiedAddr ? (
            <span className="inline-flex items-center gap-1 text-terminal-success">
              <CheckCircle2 size={14} /> {sc.cryptoWalletCopied}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Copy size={14} /> {sc.cryptoWalletCopy}
            </span>
          )}
        </button>
      </div>
    </div>
  ) : null;

  const qrBlock =
    receiveAddress && eip681Uri ? (
      <div>
        {!isDesktop ? (
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-terminal-border bg-terminal-card py-2.5 text-xs font-semibold text-terminal-muted"
          >
            <QrCode size={14} />
            {showQr ? sc.cryptoWalletHideQr : sc.cryptoWalletShowQr}
          </button>
        ) : null}
        {(isDesktop || showQr) && eip681Uri ? (
          <div
            className={`${isDesktop ? '' : 'mt-3'} flex flex-col items-center gap-2 rounded-xl border border-terminal-border bg-terminal-card p-4`}
          >
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
    ) : null;

  const showPayUi = mode === 'purchase' && fundsReady;
  const showDepositUi = !fundsReady;

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
        <div className="space-y-3 rounded-xl border border-terminal-primary/30 bg-terminal-bg/80 p-4">
          <div className="flex items-center justify-between rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-xs">
            <span className="text-terminal-muted">{sc.cryptoWalletPrivyBalanceLabel}</span>
            <span className="font-semibold text-terminal-text">
              {balanceUsdc == null ? '…' : `${balanceUsdc.toFixed(2)} USDC`}
            </span>
          </div>

          {resolvingAddress && !receiveAddress ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-3 py-3 text-[11px] text-terminal-muted">
              <Loader2 size={12} className="animate-spin text-terminal-primary" />
              {sc.cryptoWalletPrivyPreparing}
            </div>
          ) : !receiveAddress ? (
            <p className="text-[11px] leading-relaxed text-terminal-muted">{sc.cryptoWalletPrivyLoginHint}</p>
          ) : (
            <>
              {/* Address stays mounted so the layout does not jump between pay/deposit states. */}
              {showDepositUi ? (
                <p className="text-xs leading-relaxed text-terminal-text">{sc.cryptoWalletInsufficientCopyPaste}</p>
              ) : null}
              {addressBlock}
              {showDepositUi ? qrBlock : null}

              {showPayUi ? (
                <button
                  type="button"
                  onClick={() => {
                    settleCooldownUntil.current = 0;
                    settleStarted.current = true;
                    void triggerServerSettle();
                  }}
                  disabled={autoSettleStatus === 'settling'}
                  className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                >
                  {autoSettleStatus === 'settling' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Wallet size={16} />
                  )}
                  {autoSettleStatus === 'settling' ? sc.cryptoWalletAutoSettling : sc.cryptoWalletPayButton}
                </button>
              ) : null}

              {/* Only show waiting-for-deposit status when not already on the pay button. */}
              {showDepositUi && autoSettleStatus !== 'settling' ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-[11px] text-terminal-muted">
                  <Loader2 size={12} className="animate-spin text-terminal-primary" />
                  {mode === 'purchase' ? sc.cryptoWalletAutoSettleWaiting : sc.cryptoWalletWaitingDeposit}
                </div>
              ) : null}
            </>
          )}

          {settleError ? <p className="text-[11px] leading-relaxed text-red-500">{settleError}</p> : null}
        </div>
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
