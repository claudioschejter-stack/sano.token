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

type Phase = 'loading' | 'needs_funds' | 'ready' | 'settling' | 'done';

function buildEip681Uri(toAddress: string, amountUsdc: number): string {
  const uint256 = Math.round(amountUsdc * 1e6);
  return `ethereum:${USDC_BASE}@8453/transfer?address=${toAddress}&uint256=${uint256}`;
}

function normalizeAddress(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function autoSettleStorageKey(address: string, amount: number): string {
  return `sanova:crypto-autosettle:${address.toLowerCase()}:${amount.toFixed(2)}`;
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
 * Crypto checkout — one stable phase machine.
 * Never opens Privy login. Never flips ready ↔ needs_funds from RPC noise.
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
  const [phase, setPhase] = useState<Phase>('loading');
  const [settleError, setSettleError] = useState<string | null>(null);
  const [balanceUsdc, setBalanceUsdc] = useState<number | null>(null);
  const [requiredUsdc, setRequiredUsdc] = useState(amountUsd);
  const [serverAddress, setServerAddress] = useState<string | null>(null);

  const onFundedRef = useRef(onFunded);
  onFundedRef.current = onFunded;
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  const balanceRef = useRef<number | null>(null);
  const requiredRef = useRef(amountUsd);
  requiredRef.current = requiredUsdc > 0 ? requiredUsdc : amountUsd;
  const autoSettleFired = useRef(false);
  const mountedRef = useRef(true);

  const amountUsdc = requiredUsdc > 0 ? requiredUsdc : amountUsd;
  const receiveAddress = normalizeAddress(
    resolveDisplayReceiveAddress({
      serverLinkedAddress: serverAddress,
      privyClientAddress: null
    })
  );

  const mapSettleError = useCallback(
    (errorCode: string) => {
      if (errorCode === 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED') {
        return sc.cryptoWalletAutoSettleNotConfigured;
      }
      if (
        errorCode === 'USDC_BALANCE_READ_FAILED' ||
        errorCode === 'RPC_BALANCE_READ_FAILED' ||
        errorCode === 'PRIVY_WALLET_ID_NOT_FOUND'
      ) {
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

  const latchReady = useCallback(() => {
    if (phaseRef.current === 'done' || phaseRef.current === 'settling') return;
    setPhase('ready');
  }, []);

  const applyKnownBalance = useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return;
      balanceRef.current = next;
      setBalanceUsdc(next);
      const need = requiredRef.current;
      if (next + 1e-9 >= need) {
        latchReady();
      } else if (phaseRef.current === 'loading' || phaseRef.current === 'needs_funds') {
        // Only move into needs_funds from loading/needs — never downgrade from ready.
        setPhase('needs_funds');
      }
    },
    [latchReady]
  );

  const readClientBalance = useCallback(async (wallet: string): Promise<number | null> => {
    try {
      const provider = new JsonRpcProvider(BASE_RPC, 8453, { staticNetwork: true });
      const token = new Contract(USDC_BASE, ['function balanceOf(address) view returns (uint256)'], provider);
      const raw = (await token.balanceOf(wallet)) as bigint;
      provider.destroy();
      const balance = Number(formatUnits(raw, 6));
      return Number.isFinite(balance) ? balance : null;
    } catch {
      return null;
    }
  }, []);

  const runSettle = useCallback(
    async (source: 'auto' | 'manual') => {
      if (mode !== 'purchase') return;
      if (phaseRef.current === 'done') return;
      if (phaseRef.current === 'settling') return;

      setPhase('settling');
      setSettleError(null);

      try {
        const res = await fetch('/api/wallet/privy-inbound/settle', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            clientBalanceUsdc: balanceRef.current
          })
        });
        const data = (await res.json()) as {
          ok?: boolean;
          status?: string;
          error?: string;
          amountUsd?: number;
          balanceUsdc?: number | null;
        };

        if (!mountedRef.current) return;

        if (typeof data.amountUsd === 'number' && data.amountUsd > 0) {
          setRequiredUsdc(data.amountUsd);
          requiredRef.current = data.amountUsd;
        }
        if (typeof data.balanceUsdc === 'number') {
          applyKnownBalance(data.balanceUsdc);
        }

        if (res.ok && data.ok && data.status === 'settled') {
          setPhase('done');
          if (receiveAddress) {
            try {
              sessionStorage.setItem(autoSettleStorageKey(receiveAddress, requiredRef.current), 'done');
            } catch {
              /* ignore */
            }
          }
          onFundedRef.current?.();
          return;
        }

        if (data.status === 'waiting_funds') {
          // Keep showing deposit instructions; allow a later auto attempt when funded.
          autoSettleFired.current = false;
          setPhase('needs_funds');
          return;
        }

        if (data.status === 'no_pending_purchase') {
          setSettleError(mapSettleError('NO_PENDING_PURCHASE'));
          setPhase('ready');
          return;
        }

        const code =
          data.error === 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED' || data.status === 'not_configured'
            ? 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED'
            : (data.error ?? data.status ?? 'FAILED');
        setSettleError(mapSettleError(code));
        setPhase('ready');
        if (source === 'auto' && receiveAddress) {
          try {
            sessionStorage.setItem(autoSettleStorageKey(receiveAddress, requiredRef.current), 'failed');
          } catch {
            /* ignore */
          }
        }
      } catch (error) {
        if (!mountedRef.current) return;
        const message = error instanceof Error ? error.message : 'FAILED';
        setSettleError(mapSettleError(message));
        setPhase('ready');
      }
    },
    [applyKnownBalance, mapSettleError, mode, receiveAddress]
  );

  // Mount-only: provision + first watch. No dependency churn / remount flicker.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await fetch('/api/investor/wallet/provision', {
          method: 'POST',
          credentials: 'same-origin'
        }).catch(() => undefined);

        if (ensureReference && mode === 'purchase') {
          await ensureReference('USDC_ONCHAIN').catch(() => null);
        }

        const watchRes = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
        if (cancelled) return;

        let address: string | null = null;
        if (watchRes.ok) {
          const watchData = (await watchRes.json()) as {
            address?: string | null;
            balanceUsdc?: number | null;
            balanceKnown?: boolean;
            pendingPurchase?: { amountUsd?: number } | null;
            readyToAutoSettle?: boolean;
          };
          address = normalizeAddress(watchData.address);
          if (
            watchData.pendingPurchase &&
            typeof watchData.pendingPurchase.amountUsd === 'number' &&
            watchData.pendingPurchase.amountUsd > 0
          ) {
            setRequiredUsdc(watchData.pendingPurchase.amountUsd);
            requiredRef.current = watchData.pendingPurchase.amountUsd;
          }
          if (address) setServerAddress(address);

          if (watchData.balanceKnown !== false && typeof watchData.balanceUsdc === 'number') {
            applyKnownBalance(watchData.balanceUsdc);
          } else if (address) {
            const bal = await readClientBalance(address);
            if (!cancelled && bal != null) applyKnownBalance(bal);
          }

          if (watchData.readyToAutoSettle) latchReady();
        }

        if (!address) {
          const provisionRes = await fetch('/api/investor/wallet/provision', {
            method: 'POST',
            credentials: 'same-origin'
          });
          const provisionData = (await provisionRes.json()) as { walletAddress?: string };
          address = normalizeAddress(provisionData.walletAddress);
          if (address) {
            setServerAddress(address);
            const bal = await readClientBalance(address);
            if (!cancelled && bal != null) applyKnownBalance(bal);
          }
        }

        if (!cancelled && phaseRef.current === 'loading') {
          setPhase('needs_funds');
        }
      } catch {
        if (!cancelled && phaseRef.current === 'loading') {
          setPhase('needs_funds');
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
    // intentionally mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll balance / watch — never downgrades ready → needs_funds.
  useEffect(() => {
    if (phase === 'done') return;
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
          requiredRef.current = data.pendingPurchase.amountUsd;
        }

        if (data.balanceKnown !== false && typeof data.balanceUsdc === 'number') {
          applyKnownBalance(data.balanceUsdc);
        } else if (watched) {
          const bal = await readClientBalance(watched);
          if (!cancelled && bal != null) applyKnownBalance(bal);
        }

        if (mode === 'deposit') {
          const bal = balanceRef.current;
          if (
            (bal != null && bal + 1e-9 >= requiredRef.current) ||
            (data.newInbounds && data.newInbounds.length > 0)
          ) {
            setPhase('done');
            onFundedRef.current?.();
          }
          return;
        }

        if (data.readyToAutoSettle) latchReady();
      } catch {
        /* ignore */
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 6_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [applyKnownBalance, latchReady, mode, phase, readClientBalance]);

  // Auto-settle exactly once when entering ready (skipped if a prior auto attempt failed this session).
  useEffect(() => {
    if (mode !== 'purchase') return;
    if (phase !== 'ready') return;
    if (autoSettleFired.current) return;

    const addr = receiveAddress;
    if (addr) {
      try {
        const prior = sessionStorage.getItem(autoSettleStorageKey(addr, amountUsdc));
        if (prior === 'failed' || prior === 'done') {
          autoSettleFired.current = true;
          return;
        }
      } catch {
        /* ignore */
      }
    }

    autoSettleFired.current = true;
    void runSettle('auto');
  }, [amountUsdc, mode, phase, receiveAddress, runSettle]);

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

      {phase === 'done' ? (
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

          {phase === 'loading' && !receiveAddress ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-3 py-3 text-[11px] text-terminal-muted">
              <Loader2 size={12} className="animate-spin text-terminal-primary" />
              {sc.cryptoWalletPrivyPreparing}
            </div>
          ) : !receiveAddress ? (
            <p className="text-[11px] leading-relaxed text-terminal-muted">{sc.cryptoWalletPrivyLoginHint}</p>
          ) : (
            <>
              {(phase === 'needs_funds' || phase === 'loading') && (
                <p className="text-xs leading-relaxed text-terminal-text">{sc.cryptoWalletInsufficientCopyPaste}</p>
              )}
              {addressBlock}
              {(phase === 'needs_funds' || phase === 'loading') && qrBlock}

              {(phase === 'ready' || phase === 'settling') && mode === 'purchase' ? (
                <button
                  type="button"
                  onClick={() => {
                    autoSettleFired.current = true;
                    if (receiveAddress) {
                      try {
                        sessionStorage.removeItem(autoSettleStorageKey(receiveAddress, amountUsdc));
                      } catch {
                        /* ignore */
                      }
                    }
                    void runSettle('manual');
                  }}
                  disabled={phase === 'settling'}
                  className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                >
                  {phase === 'settling' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Wallet size={16} />
                  )}
                  {phase === 'settling' ? sc.cryptoWalletAutoSettling : sc.cryptoWalletPayButton}
                </button>
              ) : null}

              {phase === 'needs_funds' || phase === 'loading' ? (
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
