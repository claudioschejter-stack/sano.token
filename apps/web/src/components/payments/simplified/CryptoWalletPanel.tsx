'use client';

import { Copy, Wallet, CheckCircle2, QrCode, Loader2 } from 'lucide-react';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { usePrivyTreasuryPayment } from '../../../hooks/usePrivyTreasuryPayment';
import { usePrivyEmbeddedWallet } from '../../../hooks/usePrivyEmbeddedWallet';
import { usePrivyWalletLink } from '../../../hooks/usePrivyWalletLink';
import { resolveDisplayReceiveAddress } from '../../../lib/investor/canonicalReceiveAddress';
import type { SimplifiedCryptoWalletMethod } from '../../../lib/payments/checkoutBestRouteService';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';
import type { EnsureCheckoutReference } from './SimplifiedCheckout';

const QR_SIZE = 220;
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || 'https://mainnet.base.org';

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
  const { payToTreasury, enabled: privyEnabled } = usePrivyTreasuryPayment();
  const { ensureReady, authenticated } = usePrivyEmbeddedWallet();
  const { linkPrivyWallet } = usePrivyWalletLink();

  const [copiedAddr, setCopiedAddr] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const [depositId, setDepositId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [privyPaying, setPrivyPaying] = useState(false);
  const [privyError, setPrivyError] = useState<string | null>(null);
  const [privyBalanceUsdc, setPrivyBalanceUsdc] = useState<number | null>(null);
  const [serverAddress, setServerAddress] = useState<string | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(true);
  const [provisionBusy, setProvisionBusy] = useState(false);
  const [autoSettleStatus, setAutoSettleStatus] = useState<'idle' | 'waiting_funds' | 'settling' | 'done'>(
    'idle'
  );
  const autoSettleStarted = useRef(false);

  const onFundedRef = useRef(onFunded);
  onFundedRef.current = onFunded;

  const amountUsdc = amountUsd;
  const receiveAddress = normalizeAddress(
    resolveDisplayReceiveAddress({
      serverLinkedAddress: serverAddress,
      privyClientAddress: null
    })
  );

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

  const resolveServerAddress = useCallback(async (opts?: { forceProvision?: boolean }) => {
    setResolvingAddress(true);
    try {
      if (!opts?.forceProvision) {
        const watchRes = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
        if (watchRes.ok) {
          const watchData = (await watchRes.json()) as {
            address?: string | null;
            balanceUsdc?: number;
          };
          const fromWatch = normalizeAddress(watchData.address);
          if (fromWatch) {
            setServerAddress(fromWatch);
            if (typeof watchData.balanceUsdc === 'number') {
              setPrivyBalanceUsdc(watchData.balanceUsdc);
            } else {
              await refreshPrivyBalance(fromWatch);
            }
            return fromWatch;
          }
        }

        const linkedRes = await fetch('/api/wallet/linked-wallets', { cache: 'no-store' });
        if (linkedRes.ok) {
          const linkedData = (await linkedRes.json()) as {
            cryptoWallets?: Array<{ address?: string; isDefault?: boolean }>;
          };
          const wallets = linkedData.cryptoWallets ?? [];
          const preferred =
            wallets.find((row) => row.isDefault && row.address?.trim()) ??
            wallets.find((row) => row.address?.trim());
          const fromLinked = normalizeAddress(preferred?.address);
          if (fromLinked) {
            setServerAddress(fromLinked);
            await refreshPrivyBalance(fromLinked);
            return fromLinked;
          }
        }
      }

      const provisionRes = await fetch('/api/investor/wallet/provision', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const provisionData = (await provisionRes.json()) as {
        walletAddress?: string;
        error?: string;
      };
      const fromProvision = normalizeAddress(provisionData.walletAddress);
      if (provisionRes.ok && fromProvision) {
        setServerAddress(fromProvision);
        await refreshPrivyBalance(fromProvision);
        return fromProvision;
      }

      // Already linked under a race / alternate pointer — re-read watch.
      if (provisionData.error === 'WALLET_ALREADY_LINKED') {
        const retry = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
        if (retry.ok) {
          const retryData = (await retry.json()) as { address?: string | null; balanceUsdc?: number };
          const retryAddr = normalizeAddress(retryData.address);
          if (retryAddr) {
            setServerAddress(retryAddr);
            if (typeof retryData.balanceUsdc === 'number') {
              setPrivyBalanceUsdc(retryData.balanceUsdc);
            } else {
              await refreshPrivyBalance(retryAddr);
            }
            return retryAddr;
          }
        }
      }

      return null;
    } catch {
      return null;
    } finally {
      setResolvingAddress(false);
    }
  }, [refreshPrivyBalance]);

  useEffect(() => {
    void resolveServerAddress();
  }, [resolveServerAddress]);

  useEffect(() => {
    void refreshPrivyBalance(receiveAddress);
    if (!receiveAddress) return;
    const id = window.setInterval(() => {
      void refreshPrivyBalance(receiveAddress);
    }, 8000);
    return () => window.clearInterval(id);
  }, [receiveAddress, refreshPrivyBalance]);

  useEffect(() => {
    let cancelled = false;
    if (!ensureReference || mode !== 'purchase') return;
    void ensureReference('USDC_ONCHAIN').then((result) => {
      if (cancelled || !result) return;
      setDepositId(result.referenceId);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureReference, mode]);

  const hasEnoughPrivy =
    privyBalanceUsdc != null && Number.isFinite(privyBalanceUsdc) && privyBalanceUsdc + 1e-9 >= amountUsdc;

  const settlePurchaseFromPrivy = useCallback(async () => {
    if (mode !== 'purchase') return false;
    if (!privyEnabled) {
      throw new Error('PRIVY_NOT_CONFIGURED');
    }

    const payer = await ensureReady();
    const canonical = normalizeAddress(serverAddress);
    if (canonical && payer.toLowerCase() !== canonical.toLowerCase()) {
      throw new Error('WALLET_MISMATCH');
    }
    await linkPrivyWallet().catch(() => undefined);
    const balance = await refreshPrivyBalance(canonical ?? payer);
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
    refreshPrivyBalance,
    serverAddress
  ]);

  const handlePayWithPrivy = async () => {
    setPrivyError(null);
    setPrivyPaying(true);
    setAutoSettleStatus('settling');
    try {
      if (mode === 'deposit') {
        const payer = await ensureReady();
        const canonical = normalizeAddress(serverAddress);
        if (canonical && payer.toLowerCase() !== canonical.toLowerCase()) {
          throw new Error('WALLET_MISMATCH');
        }
        const balance = await refreshPrivyBalance(canonical ?? payer);
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
      } else if (message === 'WALLET_MISMATCH') {
        setPrivyError(sc.cryptoWalletMismatch);
      } else if (message.includes('insufficient') || message.includes('INSUFFICIENT')) {
        setPrivyError(sc.cryptoWalletInsufficientPrivy);
      } else {
        setPrivyError(sc.cryptoWalletPrivyPayError.replace('{error}', message));
      }
    } finally {
      setPrivyPaying(false);
    }
  };

  const handlePrepareWallet = async () => {
    setPrivyError(null);
    setProvisionBusy(true);
    try {
      const addr = await resolveServerAddress({ forceProvision: true });
      if (!addr) {
        setPrivyError(sc.cryptoWalletPrivyUnavailable);
      }
    } finally {
      setProvisionBusy(false);
    }
  };

  useEffect(() => {
    if (confirmed) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          address?: string | null;
          balanceUsdc?: number;
          newInbounds?: unknown[];
          readyToAutoSettle?: boolean;
        };
        const watchedAddress = normalizeAddress(data.address);
        if (watchedAddress) {
          setServerAddress(watchedAddress);
        }
        if (typeof data.balanceUsdc === 'number') {
          setPrivyBalanceUsdc(data.balanceUsdc);
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

        if (ready && !autoSettleStarted.current && privyEnabled && authenticated) {
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
            if (message === 'WALLET_MISMATCH') {
              setPrivyError(sc.cryptoWalletMismatch);
            } else {
              setPrivyError(sc.cryptoWalletPrivyPayError.replace('{error}', message));
            }
          } finally {
            setPrivyPaying(false);
          }
        } else if (ready && !authenticated) {
          // Funds are there; signing still needs a Privy client session.
          setAutoSettleStatus('idle');
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
  }, [
    amountUsdc,
    authenticated,
    confirmed,
    mode,
    privyEnabled,
    sc.cryptoWalletPrivyPayError,
    settlePurchaseFromPrivy
  ]);

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
              {privyBalanceUsdc == null ? '…' : `${privyBalanceUsdc.toFixed(2)} USDC`}
            </span>
          </div>

          {(resolvingAddress || provisionBusy) && !receiveAddress ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-3 py-3 text-[11px] text-terminal-muted">
              <Loader2 size={12} className="animate-spin text-terminal-primary" />
              {sc.cryptoWalletPrivyPreparing}
            </div>
          ) : !receiveAddress ? (
            <div className="space-y-2">
              <p className="text-[11px] leading-relaxed text-terminal-muted">{sc.cryptoWalletPrivyLoginHint}</p>
              <button
                type="button"
                onClick={() => void handlePrepareWallet()}
                disabled={provisionBusy || !privyEnabled}
                className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
              >
                {provisionBusy ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                {provisionBusy ? sc.cryptoWalletPrivyPreparing : sc.cryptoWalletPrepareButton}
              </button>
            </div>
          ) : privyBalanceUsdc == null ? (
            <>
              {addressBlock}
              {qrBlock}
              <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-[11px] text-terminal-muted">
                <Loader2 size={12} className="animate-spin text-terminal-primary" />
                {sc.cryptoWalletPrivyPreparing}
              </div>
            </>
          ) : hasEnoughPrivy ? (
            <button
              type="button"
              onClick={() => void handlePayWithPrivy()}
              disabled={privyPaying || !privyEnabled}
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
            >
              {privyPaying ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
              {privyPaying ? sc.cryptoWalletPrivyPaying : sc.cryptoWalletPayButton}
            </button>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-terminal-text">{sc.cryptoWalletInsufficientCopyPaste}</p>
              {addressBlock}
              {qrBlock}
              {autoSettleStatus === 'waiting_funds' ? (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-[11px] text-terminal-muted">
                  <Loader2 size={12} className="animate-spin text-terminal-primary" />
                  {mode === 'purchase' ? sc.cryptoWalletAutoSettleWaiting : sc.cryptoWalletWaitingDeposit}
                </div>
              ) : null}
            </>
          )}

          {autoSettleStatus === 'settling' || privyPaying ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-3 py-2 text-[11px] text-terminal-primary">
              <Loader2 size={12} className="animate-spin" />
              {sc.cryptoWalletAutoSettling}
            </div>
          ) : null}

          {privyError ? <p className="text-[11px] leading-relaxed text-red-500">{privyError}</p> : null}
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
