'use client';

import { ArrowLeft, ExternalLink, ShoppingCart, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { formatMessage } from '../../i18n';
import { useLinkedWalletGuard } from '../../hooks/useLinkedWalletGuard';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { PaymentMethod } from '@sanova/database';
import {
  groupDepositPaymentOptions,
  sortDepositPaymentOptions,
  type DepositPaymentOption,
  type DepositPaymentOptionGroup
} from '../../lib/payments/depositPaymentOptions';
import { collectionWalletHref } from '../../lib/navigation/collectionWalletPath';
import { isLocalRailManualResult, isPendingManualGatewayResult, isRipioOnRampResult, isWiseManualResult } from '../../lib/payments/stripeCheckoutOptions';
import { fetchMarketplaceFeedClient } from '../../lib/marketplaceApi';
import { useCartStore } from '../../store/useCartStore';
import type { PublicPaymentIntent } from '../../lib/payments/paymentService';
import { InvestorWalletLinker } from '../wallet/InvestorWalletLinker';
import { StickyActionBar } from '../mobile/StickyActionBar';
import { PaymentMethodLogosButton } from './PaymentMethodLogosButton';
import { WalletConnectConnectButton } from '../wallet/WalletConnectConnectButton';
import { BASE_CHAIN_ID } from '../../lib/web3/config';
import { pickCoinbaseConnector } from '../../lib/web3/walletConnectors';
import { vaultShareDeliveryUiState } from '../../lib/payments/vaultShareDeliveryStatus';
import {
  isMercadoPagoEmbeddedResult,
  MERCADOPAGO_WALLET_OPTION_ID,
  type MercadoPagoEmbeddedSession
} from '../../lib/payments/mercadoPagoEmbeddedService';
import { MercadoPagoWalletBrick } from '../payments/MercadoPagoWalletBrick';

type CartCheckoutResult = {
  batchId: string;
  totalUsd: string;
  totalTokens: number;
  method: PaymentMethod;
  confirmed: boolean;
  manualReview?: boolean;
  provider?: string | null;
  providerCheckoutUrl: string | null;
  payToAddress: string | null;
  stablecoinNetwork: string | null;
  paymentIntents?: PublicPaymentIntent[];
  embeddedCheckout?: MercadoPagoEmbeddedSession | null;
};

type DepositResponse = {
  id: string;
  status: string;
  amountUsd: string;
  method: string;
  provider?: string | null;
  payToAddress: string | null;
  providerCheckoutUrl: string | null;
  metadata?: Record<string, unknown> | null;
};

type DepositQuoteResponse = {
  options?: DepositPaymentOption[];
  groups?: DepositPaymentOptionGroup[];
  quoteExpiresAt?: string;
  quoteTtlSeconds?: number;
  recommendedOptionId?: string | null;
  stablecoinNetworks?: Array<{ id: string; label: string; symbol: string; cheapestRank: number }>;
};

function formatUsdc2(amount: number, locale: string): string {
  return `USDC ${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsd2(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function investorFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function optionUsesUsdc(option: DepositPaymentOption): boolean {
  return option.method === 'USDC_ONCHAIN' || option.method === 'CUSTODIAL_STABLECOIN';
}

function formatMoneyAmount(amount: number, useUsdc: boolean, locale: string): string {
  return useUsdc ? formatUsdc2(amount, locale) : formatUsd2(amount, locale);
}

const COMPACT_ROW = 'flex items-baseline justify-between gap-3 leading-none py-[0.5mm]';
const AMOUNT_RIGHT = 'shrink-0 text-right font-mono tabular-nums';

function formatDepositLocal(amount: number, currencyCode: string, intlLocale: string) {
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0
  }).format(amount);
}

const CURRENCY_COUNTRY: Record<string, string> = {
  ARS: 'AR',
  BRL: 'BR',
  USD: 'US',
  EUR: 'EU',
  INR: 'IN',
  MXN: 'MX'
};

type CartCheckoutViewProps = {
  investorName: string;
  initialMode?: 'purchase' | 'deposit' | 'wallet';
};

export function CartCheckoutView({ investorName, initialMode = 'purchase' }: CartCheckoutViewProps) {
  const t = useTranslation();
  const c = t.cartCheckout;
  const w = t.wallet;
  const { intlLocale } = useLocale();
  const { formatFromUsd, formatUsd, formatUsdPlain, currency, rates, intlLocale: currencyLocale } = useLocalCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected, connector, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const walletGuard = useLinkedWalletGuard();

  const mode =
    searchParams.get('mode') === 'deposit'
      ? 'deposit'
      : searchParams.get('mode') === 'wallet'
        ? 'wallet'
        : initialMode;
  const returnStatus = searchParams.get('status');
  const batchFromQuery = searchParams.get('batch');
  const depositFromQuery = searchParams.get('deposit');
  const providerFromQuery = searchParams.get('provider');

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const cartTotalUsd = useCartStore((state) => state.totalUsd());
  const cartItemCount = useCartStore((state) => state.itemCount());
  const reconcileInventory = useCartStore((state) => state.reconcileInventory);

  useEffect(() => {
    if (mode !== 'purchase' || items.length === 0) {
      return;
    }

    let cancelled = false;
    void fetchMarketplaceFeedClient()
      .then((feed) => {
        if (cancelled) {
          return;
        }
        reconcileInventory(
          feed.listings.map((listing) => ({
            projectId: listing.id,
            availableTokens: listing.availableTokens,
            pricePerTokenUsd: listing.pricePerTokenUsd
          }))
        );
      })
      .catch(() => {
        // keep cached cart if feed unavailable
      });

    return () => {
      cancelled = true;
    };
  }, [items.length, mode, reconcileInventory]);

  const [depositOptions, setDepositOptions] = useState<DepositPaymentOption[]>([]);
  const [depositOptionGroups, setDepositOptionGroups] = useState<DepositPaymentOptionGroup[]>([]);
  const [recommendedOptionId, setRecommendedOptionId] = useState<string | null>(null);
  const [stablecoinNetworkOptions, setStablecoinNetworkOptions] = useState<
    Array<{ id: string; label: string; symbol: string; cheapestRank: number }>
  >([]);
  const [selectedDepositOptionId, setSelectedDepositOptionId] = useState<string | null>(null);
  const [quoteExpiresAt, setQuoteExpiresAt] = useState<string | null>(null);
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MERCADO_PAGO');
  const [stablecoinNetwork, setStablecoinNetwork] = useState('BASE');
  const [depositAmount, setDepositAmount] = useState('100');
  const [manualTxHash, setManualTxHash] = useState('');
  const [batchId, setBatchId] = useState<string | null>(batchFromQuery);
  const [checkout, setCheckout] = useState<CartCheckoutResult | null>(null);
  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const [status, setStatus] = useState<
    | 'idle'
    | 'processing'
    | 'manual'
    | 'pending_gateway'
    | 'mercadopago_embedded'
    | 'verifying'
    | 'done'
    | 'share_pending'
    | 'share_failed'
  >('idle');
  const [embeddedSession, setEmbeddedSession] = useState<MercadoPagoEmbeddedSession | null>(null);
  const [embeddedReference, setEmbeddedReference] = useState<string | null>(null);
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethodsExpanded, setPaymentMethodsExpanded] = useState(false);

  const totalUsd = mode === 'deposit' ? Number(depositAmount) || 0 : cartTotalUsd;
  const depositCountry = CURRENCY_COUNTRY[currency] ?? 'AR';
  const sortedDepositOptions = useMemo(() => sortDepositPaymentOptions(depositOptions), [depositOptions]);
  const paymentGroups = useMemo(
    () => (depositOptionGroups.length > 0 ? depositOptionGroups : groupDepositPaymentOptions(depositOptions)),
    [depositOptionGroups, depositOptions]
  );

  const selectedDepositOption = useMemo(
    () => sortedDepositOptions.find((row) => row.id === selectedDepositOptionId) ?? null,
    [sortedDepositOptions, selectedDepositOptionId]
  );
  const showPaymentMethods =
    (mode === 'deposit' && totalUsd > 0) || (mode === 'purchase' && items.length > 0);
  const requiresWallet =
    selectedDepositOption?.method === 'CUSTODIAL_STABLECOIN' ||
    selectedDepositOption?.method === 'USDC_ONCHAIN';
  const isWalletConnectUsdc = selectedDepositOptionId === 'walletconnect_usdc';
  const isWalletConnectSession =
    isConnected &&
    (connector?.id === 'walletConnect' || connector?.type === 'walletConnect');
  const showWalletLinker = requiresWallet && mode !== 'deposit' && !isWalletConnectUsdc;
  const linkedWalletAddress = walletGuard.linkedWallet;
  const paymentQuoteExpired = showPaymentMethods && quoteSecondsLeft <= 0 && quoteExpiresAt !== null;

  const reconnectCoinbaseWallet = useCallback(async () => {
    const coinbase = pickCoinbaseConnector(connectors);
    if (!coinbase) {
      return;
    }
    try {
      await disconnectAsync();
      await connectAsync({ connector: coinbase, chainId: BASE_CHAIN_ID });
    } catch {
      /* usuario puede reconectar manualmente */
    }
  }, [connectAsync, connectors, disconnectAsync]);

  const loadDepositQuote = useCallback(() => {
    if (!Number.isFinite(totalUsd) || totalUsd <= 0) {
      setDepositOptions([]);
      setDepositOptionGroups([]);
      setSelectedDepositOptionId(null);
      setQuoteExpiresAt(null);
      setQuoteSecondsLeft(0);
      return () => undefined;
    }

    const controller = new AbortController();
    const fxRate = rates[currency] ?? rates.USD ?? 1;

    void fetch(
      `/api/marketplace/cart/deposit-options?amountUsd=${encodeURIComponent(String(totalUsd))}&country=${encodeURIComponent(depositCountry)}&fxRate=${encodeURIComponent(String(fxRate))}`,
      { cache: 'no-store', signal: controller.signal }
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data: DepositQuoteResponse | null) => {
        const next = sortDepositPaymentOptions(data?.options ?? []);
        setDepositOptions(next);
        setDepositOptionGroups(data?.groups ?? groupDepositPaymentOptions(next));
        setRecommendedOptionId(data?.recommendedOptionId ?? null);
        setStablecoinNetworkOptions(data?.stablecoinNetworks ?? []);
        setQuoteExpiresAt(data?.quoteExpiresAt ?? null);
        const expiresMs = data?.quoteExpiresAt ? new Date(data.quoteExpiresAt).getTime() - Date.now() : 0;
        setQuoteSecondsLeft(Math.max(0, Math.ceil(expiresMs / 1000)));

        setSelectedDepositOptionId((current) => {
          if (current && next.some((row) => row.id === current && row.configured)) {
            return current;
          }
          const recommended = data?.recommendedOptionId;
          if (recommended && next.some((row) => row.id === recommended && row.configured)) {
            return recommended;
          }
          return next.find((row) => row.configured)?.id ?? null;
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDepositOptions([]);
          setDepositOptionGroups([]);
          setSelectedDepositOptionId(null);
          setQuoteExpiresAt(null);
          setQuoteSecondsLeft(0);
        }
      });

    return () => controller.abort();
  }, [currency, depositCountry, rates, totalUsd]);

  useEffect(() => {
    if (!showPaymentMethods) {
      setDepositOptions([]);
      setDepositOptionGroups([]);
      setSelectedDepositOptionId(null);
      setQuoteExpiresAt(null);
      setQuoteSecondsLeft(0);
      return;
    }

    const timer = window.setTimeout(() => {
      loadDepositQuote();
    }, 280);

    return () => window.clearTimeout(timer);
  }, [loadDepositQuote, showPaymentMethods, walletGuard.isWalletLinked]);

  useEffect(() => {
    if (!showPaymentMethods || !quoteExpiresAt) {
      return;
    }

    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(quoteExpiresAt).getTime() - Date.now()) / 1000));
      setQuoteSecondsLeft(seconds);
      return seconds;
    };

    if (tick() === 0) {
      loadDepositQuote();
      return;
    }

    const interval = window.setInterval(() => {
      if (tick() === 0) {
        window.clearInterval(interval);
        loadDepositQuote();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loadDepositQuote, quoteExpiresAt, showPaymentMethods]);

  useEffect(() => {
    if (!selectedDepositOption) {
      return;
    }

    setPaymentMethod(selectedDepositOption.method);
    if (selectedDepositOption.stablecoinNetwork && mode === 'purchase') {
      setStablecoinNetwork(selectedDepositOption.stablecoinNetwork);
    }
  }, [selectedDepositOption]);

  useEffect(() => {
    if (mode !== 'deposit' || !depositFromQuery || !returnStatus) {
      return;
    }
    if (returnStatus !== 'pending' && returnStatus !== 'success' && returnStatus !== 'failed') {
      return;
    }

    let cancelled = false;
    setError(null);

    const loadDepositReturn = async () => {
      try {
        const response = await fetch(
          `/api/wallet/deposit-intents?id=${encodeURIComponent(depositFromQuery)}`,
          { cache: 'no-store' }
        );
        const data = (await response.json()) as { error?: string; deposit?: DepositResponse };
        if (!response.ok || !data.deposit) {
          if (!cancelled) {
            setError(data.error ?? 'DEPOSIT_LOAD_FAILED');
            setStatus('idle');
          }
          return;
        }

        if (cancelled) {
          return;
        }

        setDeposit(data.deposit);

        const providerMeta =
          (data.deposit.metadata?.provider as Record<string, unknown> | undefined) ?? data.deposit.metadata ?? null;

        if (returnStatus === 'failed') {
          if (isMercadoPagoEmbeddedResult(providerMeta)) {
            setEmbeddedSession(providerMeta);
            setEmbeddedReference(data.deposit.id);
            setSelectedDepositOptionId(MERCADOPAGO_WALLET_OPTION_ID);
            setStatus('mercadopago_embedded');
            setError('El pago con Mercado Pago fue cancelado o rechazado. Podés intentar de nuevo.');
          } else {
            setError('El pago con Mercado Pago fue cancelado o rechazado.');
            setStatus('idle');
          }
          return;
        }

        const ripioPending =
          returnStatus === 'pending' ||
          providerFromQuery === 'ripio' ||
          data.deposit.provider === 'ripio' ||
          isRipioOnRampResult(providerMeta);

        if (ripioPending && data.deposit.status !== 'CONFIRMED') {
          setPendingReference(data.deposit.id);
          setStatus('pending_gateway');
          return;
        }

        if (returnStatus === 'success' && data.deposit.status === 'CONFIRMED') {
          setStatus('done');
          return;
        }

        if (returnStatus === 'success') {
          setStatus('verifying');
          let attempts = 0;
          while (!cancelled && attempts < 30) {
            attempts += 1;
            await new Promise((resolve) => window.setTimeout(resolve, 2000));
            const poll = await fetch(
              `/api/wallet/deposit-intents?id=${encodeURIComponent(depositFromQuery)}`,
              { cache: 'no-store' }
            );
            const pollData = (await poll.json()) as { deposit?: DepositResponse };
            if (poll.ok && pollData.deposit?.status === 'CONFIRMED') {
              if (!cancelled) {
                setDeposit(pollData.deposit);
                setStatus('done');
              }
              return;
            }
          }
          if (!cancelled) {
            setStatus('pending_gateway');
            setPendingReference(data.deposit.id);
          }
        }
      } catch {
        if (!cancelled) {
          setError('DEPOSIT_LOAD_FAILED');
          setStatus('idle');
        }
      }
    };

    void loadDepositReturn();

    return () => {
      cancelled = true;
    };
  }, [depositFromQuery, mode, providerFromQuery, returnStatus]);

  useEffect(() => {
    if (returnStatus !== 'success' || !batchFromQuery || mode !== 'purchase') {
      return;
    }

    setBatchId(batchFromQuery);
    setStatus('verifying');
    setError(null);

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const pollBatchStatus = async () => {
      while (!cancelled && attempts < maxAttempts) {
        attempts += 1;

        try {
          const response = await fetch(
            `/api/marketplace/cart/status?batchId=${encodeURIComponent(batchFromQuery)}&sync=1`,
            { cache: 'no-store' }
          );
          const data = (await response.json()) as {
            status?: {
              found: boolean;
              allConfirmed: boolean;
              paymentIntents?: PublicPaymentIntent[];
            };
          };

          if (response.ok && data.status?.allConfirmed) {
            clearCart();
            applyCartPostPurchaseStatus(data.status.paymentIntents ?? []);
            void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
            return;
          }

          const hasFailed = data.status?.paymentIntents?.some((row) => row.status === 'FAILED');
          if (response.ok && hasFailed) {
            setStatus('idle');
            setError(c.checkoutFailed);
            return;
          }

          if (response.ok && data.status?.found && !data.status.allConfirmed) {
            await new Promise((resolve) => window.setTimeout(resolve, 2000));
            continue;
          }
        } catch {
          // retry
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      if (!cancelled) {
        setStatus('idle');
        setError(c.localRailPendingBody.replace('{method}', 'pasarela').replace('{reference}', batchFromQuery));
      }
    };

    void pollBatchStatus();

    return () => {
      cancelled = true;
    };
  }, [batchFromQuery, c.localRailPendingBody, clearCart, mode, paymentMethod, returnStatus]);

  const handleConfirm = async () => {
    if (mode === 'purchase' && items.length === 0) {
      setError(c.emptyCart);
      return;
    }

    if (mode === 'deposit' && (!Number.isFinite(totalUsd) || totalUsd <= 0)) {
      setError(c.invalidAmount);
      return;
    }

    if (showPaymentMethods && paymentQuoteExpired) {
      setError(c.quoteExpired);
      loadDepositQuote();
      return;
    }

    if (showPaymentMethods && !selectedDepositOptionId) {
      setError(c.choosePaymentMethod);
      return;
    }

    if (showPaymentMethods && (!selectedDepositOption?.configured || !selectedDepositOptionId)) {
      setError(c.paymentUnavailable);
      return;
    }

    if (requiresWallet) {
      if (!walletGuard.isWalletLinked || !linkedWalletAddress) {
        setError(w.walletNotLinked);
        return;
      }

      if (mode === 'purchase') {
        if (isWalletConnectUsdc) {
          if (!isConnected || !address) {
            setError(c.walletConnectConnectFirst);
            return;
          }
          if (chainId != null && chainId !== BASE_CHAIN_ID) {
            setError(w.wrongNetwork);
            return;
          }
        } else if (!walletGuard.canSignOnChain || !address) {
          setError(
            walletGuard.isWrongNetwork ? w.wrongNetwork : walletGuard.isWalletMismatch ? w.walletMismatch : w.noWallet
          );
          return;
        }
      }
    }

    setStatus('processing');
    setError(null);
    setCheckout(null);
    setDeposit(null);
    setEmbeddedSession(null);
    setEmbeddedReference(null);

    try {
      if (mode === 'deposit') {
        const response = await fetch('/api/wallet/deposit-intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountUsd: totalUsd,
            method: paymentMethod,
            paymentOptionId: selectedDepositOptionId,
            auto: false,
            stablecoinNetwork,
            walletAddress: linkedWalletAddress
          })
        });

        const data = (await response.json()) as { error?: string; deposit?: DepositResponse };
        if (!response.ok || !data.deposit) {
          if (data.error === 'INVESTOR_WALLET_REQUIRED') {
            window.location.href = collectionWalletHref({ returnTo: '/marketplace/carrito?mode=deposit' });
            return;
          }
          throw new Error(data.error ?? 'DEPOSIT_CREATE_FAILED');
        }

        setDeposit(data.deposit);

        const providerMeta =
          (data.deposit.metadata?.provider as Record<string, unknown> | undefined) ?? data.deposit.metadata ?? null;
        if (isMercadoPagoEmbeddedResult(providerMeta)) {
          setEmbeddedSession(providerMeta);
          setEmbeddedReference(data.deposit.id);
          setStatus('mercadopago_embedded');
          return;
        }

        if (data.deposit.providerCheckoutUrl && selectedDepositOptionId !== MERCADOPAGO_WALLET_OPTION_ID) {
          const checkoutUrl = data.deposit.providerCheckoutUrl;
          const isInternalReturn =
            checkoutUrl.includes('/marketplace/carrito') && checkoutUrl.includes('status=pending');
          if (!isInternalReturn) {
            window.location.href = checkoutUrl;
            return;
          }
        }

        if (paymentMethod === 'USDC_ONCHAIN' || paymentMethod === 'CUSTODIAL_STABLECOIN') {
          setStatus('manual');
          return;
        }

        if (
          paymentMethod === 'LOCAL_RAIL' ||
          paymentMethod === 'BRIDGE' ||
          paymentMethod === 'RIPIO' ||
          isPendingManualGatewayResult(providerMeta)
        ) {
          setPendingReference(data.deposit.id);
          setStatus('pending_gateway');
          return;
        }

        setError('PAYMENT_GATEWAY_NOT_CONFIGURED');
        setStatus('idle');
        return;
      }

      const response = await fetch('/api/marketplace/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((row) => ({ projectId: row.projectId, tokenCount: row.tokenCount })),
          method: paymentMethod,
          paymentOptionId: selectedDepositOptionId,
          walletAddress: isWalletConnectUsdc ? linkedWalletAddress : address,
          stablecoinNetwork
        })
      });

      const data = (await response.json()) as { error?: string; checkout?: CartCheckoutResult };
      if (!response.ok || !data.checkout) {
        if (data.error === 'INVESTOR_WALLET_REQUIRED') {
          window.location.href = collectionWalletHref({ returnTo: '/marketplace/carrito' });
          return;
        }
        if (data.error === 'ACCOUNT_NOT_OPERATIONAL' || data.error === 'KYC_NOT_APPROVED') {
          window.location.href = `/kyc?returnTo=${encodeURIComponent('/marketplace/carrito')}`;
          return;
        }
        if (data.error === 'CART_MANUAL_REVIEW_REQUIRED') {
          setError('CART_MANUAL_REVIEW_REQUIRED');
          setStatus('idle');
          return;
        }
        throw new Error(data.error ?? 'CART_CHECKOUT_FAILED');
      }

      setCheckout(data.checkout);
      setBatchId(data.checkout.batchId);

      if (data.checkout.embeddedCheckout) {
        setEmbeddedSession(data.checkout.embeddedCheckout);
        setEmbeddedReference(data.checkout.paymentIntents?.[0]?.id ?? null);
        setStatus('mercadopago_embedded');
        return;
      }

      if (data.checkout.manualReview) {
        setCheckout(data.checkout);
        setPendingReference(data.checkout.batchId);
        setStatus('pending_gateway');
        return;
      }

      if (data.checkout.confirmed) {
        clearCart();
        applyCartPostPurchaseStatus(data.checkout.paymentIntents ?? []);
        void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
        return;
      }

      if (data.checkout.providerCheckoutUrl) {
        window.location.href = data.checkout.providerCheckoutUrl;
        return;
      }

      if (
        paymentMethod !== 'USDC_ONCHAIN' &&
        paymentMethod !== 'CUSTODIAL_STABLECOIN' &&
        paymentMethod !== 'LOCAL_RAIL' &&
        !data.checkout.payToAddress
      ) {
        setError('PAYMENT_GATEWAY_NOT_CONFIGURED');
        setStatus('idle');
        return;
      }

      if (paymentMethod === 'USDC_ONCHAIN' || paymentMethod === 'CUSTODIAL_STABLECOIN') {
        setStatus('manual');
        return;
      }

      if (paymentMethod === 'LOCAL_RAIL') {
        setPendingReference(data.checkout.batchId);
        setStatus('pending_gateway');
        return;
      }

      setStatus('idle');
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : 'CHECKOUT_FAILED';
      setError(message === 'CART_CHECKOUT_FAILED' ? c.checkoutFailed : message === 'CHOOSE_PAYMENT' ? c.choosePaymentMethod : message);
      setStatus('idle');
    }
  };

  const applyCartPostPurchaseStatus = (intents: PublicPaymentIntent[]) => {
    const vaultIntents = intents.filter(
      (row) => (row.metadata as Record<string, unknown> | null)?.purchaseMode === 'ERC4626_DEPOSIT'
    );
    if (!vaultIntents.length) {
      setStatus('done');
      return;
    }

    const deliveryFailed = vaultIntents.some(
      (row) => vaultShareDeliveryUiState((row.metadata ?? {}) as Record<string, unknown>) === 'failed'
    );
    const deliveryPending = vaultIntents.some(
      (row) => vaultShareDeliveryUiState((row.metadata ?? {}) as Record<string, unknown>) === 'pending'
    );

    if (deliveryFailed) {
      setError('VAULT_SHARE_DELIVERY_FAILED');
      setStatus('share_failed');
    } else if (deliveryPending) {
      setStatus('share_pending');
    } else {
      setStatus('done');
    }
  };

  const verifyUsdcPayment = async () => {
    if (!batchId || !manualTxHash.trim()) {
      return;
    }

    setStatus('verifying');
    setError(null);

    const response = await fetch('/api/marketplace/cart/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        txHash: manualTxHash.trim(),
        walletAddress: isWalletConnectUsdc ? address : linkedWalletAddress ?? address
      })
    });

    const data = (await response.json()) as {
      error?: string;
      paymentIntents?: PublicPaymentIntent[];
    };
    if (!response.ok) {
      setError(data.error ?? 'STABLECOIN_VERIFY_FAILED');
      setStatus('manual');
      return;
    }

    const intents = data.paymentIntents ?? [];
    clearCart();
    applyCartPostPurchaseStatus(intents);
    void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
  };

  const verifyDepositTx = async () => {
    if (!deposit || !manualTxHash.trim()) {
      return;
    }

    setStatus('verifying');
    setError(null);

    const response = await fetch('/api/wallet/deposit-intents/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depositId: deposit.id,
        txHash: manualTxHash.trim(),
        walletAddress: linkedWalletAddress ?? undefined
      })
    });

    const data = (await response.json()) as { error?: string; deposit?: DepositResponse };
    if (!response.ok || !data.deposit) {
      setError(data.error ?? 'STABLECOIN_VERIFY_FAILED');
      setStatus('manual');
      return;
    }

    setDeposit(data.deposit);
    setStatus('done');
  };

  const pollEmbeddedDepositConfirmation = useCallback(async (depositId: string) => {
    setStatus('verifying');
    setError(null);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      const response = await fetch(`/api/wallet/deposit-intents?id=${encodeURIComponent(depositId)}`, {
        cache: 'no-store'
      });
      const data = (await response.json()) as { deposit?: DepositResponse };
      if (response.ok && data.deposit?.status === 'CONFIRMED') {
        setDeposit(data.deposit);
        setStatus('done');
        return;
      }
    }

    setPendingReference(depositId);
    setStatus('pending_gateway');
  }, []);

  const pollEmbeddedCartConfirmation = useCallback(
    async (activeBatchId: string) => {
      setStatus('verifying');
      setError(null);

      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const response = await fetch(
          `/api/marketplace/cart/status?batch=${encodeURIComponent(activeBatchId)}`,
          { cache: 'no-store' }
        );
        const data = (await response.json()) as {
          allConfirmed?: boolean;
          paymentIntents?: PublicPaymentIntent[];
        };
        if (response.ok && data.allConfirmed) {
          clearCart();
          applyCartPostPurchaseStatus(data.paymentIntents ?? []);
          void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
          return;
        }
      }

      setPendingReference(activeBatchId);
      setStatus('pending_gateway');
    },
    [clearCart]
  );

  const handleEmbeddedApproved = useCallback(async () => {
    if (mode === 'deposit' && deposit?.id) {
      const response = await fetch(`/api/wallet/deposit-intents?id=${encodeURIComponent(deposit.id)}`, {
        cache: 'no-store'
      });
      const data = (await response.json()) as { deposit?: DepositResponse };
      if (response.ok && data.deposit) {
        setDeposit(data.deposit);
      }
      setStatus('done');
      return;
    }

    if (mode === 'purchase' && batchId) {
      const response = await fetch(`/api/marketplace/cart/status?batch=${encodeURIComponent(batchId)}`, {
        cache: 'no-store'
      });
      const data = (await response.json()) as {
        paymentIntents?: PublicPaymentIntent[];
      };
      clearCart();
      applyCartPostPurchaseStatus(data.paymentIntents ?? []);
      void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
    }
  }, [batchId, clearCart, deposit?.id, mode]);

  const handleEmbeddedPending = useCallback(() => {
    if (mode === 'deposit' && deposit?.id) {
      void pollEmbeddedDepositConfirmation(deposit.id);
      return;
    }
    if (mode === 'purchase' && batchId) {
      void pollEmbeddedCartConfirmation(batchId);
    }
  }, [batchId, deposit?.id, mode, pollEmbeddedCartConfirmation, pollEmbeddedDepositConfirmation]);

  const payToAddress = mode === 'deposit' ? deposit?.payToAddress : checkout?.payToAddress;
  const pendingManualMeta =
    mode === 'deposit'
      ? ((deposit?.metadata?.provider as Record<string, unknown> | undefined) ?? deposit?.metadata ?? null)
      : ((checkout?.paymentIntents?.[0]?.metadata as Record<string, unknown> | undefined)?.gateway as
          Record<string, unknown> | undefined) ?? null;
  const isWisePending = isWiseManualResult(pendingManualMeta);
  const isRipioPending =
    pendingManualMeta?.mode === 'ripio_on_ramp' ||
    deposit?.provider === 'ripio' ||
    checkout?.provider === 'ripio';

  const renderDepositOption = (option: DepositPaymentOption) => {
    const selected = selectedDepositOptionId === option.id;
    const useUsdc = optionUsesUsdc(option);
    const amountPrimary =
      option.usesLocalCurrency && option.totalLocal != null
        ? formatUsd2(option.totalLocal, currencyLocale)
        : formatMoneyAmount(option.totalUsd, useUsdc, currencyLocale);

    return (
      <div key={option.id} className={`bg-white ${!option.configured ? 'opacity-70' : ''}`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedDepositOptionId(option.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setSelectedDepositOptionId(option.id);
            }
          }}
          className={`flex w-full cursor-pointer items-center gap-2 px-3 py-[1mm] text-left transition-colors ${
            selected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
          }`}
        >
          <div className="min-w-0 flex-1">
            <span
              className={`block font-semibold text-slate-900 text-[120%] leading-tight ${selected ? '' : ''}`}
            >
              {option.label}
              {option.id === recommendedOptionId && option.configured ? (
                <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-800">
                  {c.recommendedBadge}
                </span>
              ) : null}
            </span>
            {!option.configured ? (
              <span className="mt-0.5 block text-[10px] font-medium uppercase text-amber-700">
                {c.paymentUnavailable}
              </span>
            ) : option.id === 'walletconnect_usdc' && walletGuard.linkedWallet ? (
              <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">
                {formatMessage(c.walletConnectReceiveHint, {
                  address: `${walletGuard.linkedWallet.slice(0, 6)}…${walletGuard.linkedWallet.slice(-4)}`
                })}
              </span>
            ) : option.id === 'electronic_wallet' && walletGuard.linkedWallet ? (
              <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">
                {formatMessage(c.electronicWalletLinkedHint, {
                  address: `${walletGuard.linkedWallet.slice(0, 6)}…${walletGuard.linkedWallet.slice(-4)}`
                })}
              </span>
            ) : option.id === 'mercadopago_wallet' ? (
              <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">
                Pago in-app con saldo de tu cuenta Mercado Pago
              </span>
            ) : option.id === 'mercado_pago' ? (
              <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">
                Te redirige al checkout de Mercado Pago
              </span>
            ) : null}
          </div>
          <div className={`${AMOUNT_RIGHT} text-[120%] font-bold text-blue-700`}>{amountPrimary}</div>
          <button
            type="button"
            aria-label={option.label}
            aria-pressed={selected}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedDepositOptionId(option.id);
            }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white transition-colors ${
              selected ? 'border-blue-600' : 'border-slate-300 hover:border-blue-400'
            }`}
          >
            {selected ? <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> : null}
          </button>
        </div>
        {selected ? (
          <div className="space-y-0 border-t border-slate-200 bg-slate-50 px-3 py-[1mm] text-[11px] text-slate-700">
            {option.id === 'walletconnect_usdc' ? (
              <div className="flex flex-col items-center gap-2 py-[1mm]">
                <p className="text-center text-[10px] text-slate-600">{c.walletConnectTapIcon}</p>
                <WalletConnectConnectButton iconOnly />
                {isWalletConnectSession && address ? (
                  <p className="font-mono text-[10px] text-emerald-700">
                    {formatMessage(c.walletConnectPayingFromShort, {
                      address: `${address.slice(0, 6)}…${address.slice(-4)}`
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className={COMPACT_ROW}>
              <span>{c.feeCommission}</span>
              <span className={`${AMOUNT_RIGHT} font-medium text-slate-900`}>
                {formatMoneyAmount(option.platformFeeUsd, useUsdc, currencyLocale)}
              </span>
            </div>
            <div className={COMPACT_ROW}>
              <span>{c.feeGas}</span>
              <span className={`${AMOUNT_RIGHT} font-medium text-slate-900`}>
                {formatMoneyAmount(option.gasFeeUsd, useUsdc, currencyLocale)}
              </span>
            </div>
            <div className={COMPACT_ROW}>
              <span>{c.feeOther}</span>
              <span className={`${AMOUNT_RIGHT} font-medium text-slate-900`}>
                {formatMoneyAmount(option.networkFeeUsd, useUsdc, currencyLocale)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const displayTotalUsd = selectedDepositOption?.totalUsd ?? sortedDepositOptions.find((o) => o.configured)?.totalUsd ?? totalUsd;
  const feePreviewOption = selectedDepositOption ?? sortedDepositOptions.find((o) => o.configured) ?? null;
  const feesUseUsdc = feePreviewOption ? optionUsesUsdc(feePreviewOption) : true;
  const greetingName = investorFirstName(investorName);

  const confirmDisabled =
    (status !== 'idle' && status !== 'manual') ||
    (mode === 'purchase' && items.length === 0) ||
    (showPaymentMethods && paymentQuoteExpired) ||
    (requiresWallet &&
      selectedDepositOptionId &&
      (mode === 'deposit'
        ? !walletGuard.isWalletLinked
        : isWalletConnectUsdc
          ? !walletGuard.isWalletLinked || !isWalletConnectSession
          : !walletGuard.canSignOnChain));

  const confirmLabel =
    status === 'processing'
      ? c.processing
      : status === 'verifying'
        ? c.verifying
        : mode === 'deposit'
          ? c.continueDeposit
          : isWalletConnectUsdc
            ? c.continuePurchase
            : c.confirmButton;

  return (
    <section className="mx-auto max-w-3xl pb-28 md:pb-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={mode === 'deposit' ? '/dashboard/portfolio' : '/marketplace'}
          className="inline-flex items-center gap-2 text-sm text-terminal-muted hover:text-terminal-text"
        >
          <ArrowLeft size={16} />
          {mode === 'deposit' ? c.backToWallet : t.common.backToMarketplace}
        </Link>
        {mode === 'purchase' ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-terminal-border bg-terminal-card px-3 py-1 text-xs font-semibold text-terminal-muted">
            <ShoppingCart size={14} />
            {formatMessage(c.itemsBadge, { count: cartItemCount })}
          </span>
        ) : null}
      </div>

      <article className="overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
        <div className="border-b border-terminal-border px-4 py-[2mm] sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-terminal-primary">
            {mode === 'deposit' ? c.depositTitle : c.paymentMenuTitle}
          </p>
          <h1 className="mt-1 text-xl font-bold leading-tight text-terminal-text">
            {mode === 'deposit' ? investorName : formatMessage(c.paymentMenuGreeting, { name: greetingName })}
          </h1>
          <p className="mt-0.5 text-xs leading-tight text-terminal-muted">
            {mode === 'deposit' ? c.depositSubtitle : c.paymentMenuSubtitle}
          </p>
        </div>

        <div className="px-4 sm:px-6">
          {mode === 'purchase' ? (
            items.length === 0 ? (
              <p className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-6 text-sm text-terminal-muted">
                {c.emptyCart}
              </p>
            ) : (
              <div className="border-b border-terminal-border py-[2mm]">
                <p className="text-xs font-semibold uppercase tracking-wide text-terminal-muted">{c.cartSummaryTitle}</p>
                <div className="mt-[1mm] space-y-[1mm]">
                {items.map((item) => (
                  <div
                    key={item.projectId}
                    className="flex gap-3 rounded-lg border border-terminal-border bg-terminal-bg p-2"
                  >
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md">
                      <Image src={item.imageUrl} alt={item.title} fill className="object-cover" sizes="80px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold leading-tight text-terminal-text">{item.title}</p>
                          {item.tokenSymbol ? (
                            <p className="font-mono text-[10px] text-terminal-primary">{item.tokenSymbol}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.projectId)}
                          className="rounded-lg p-0.5 text-terminal-muted hover:text-terminal-warning"
                          aria-label={c.removeItem}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-terminal-muted">
                          {formatMessage(c.itemsBadge, { count: item.tokenCount })}
                        </span>
                        <span className={`${AMOUNT_RIGHT} font-semibold text-terminal-primary`}>
                          {formatUsdc2(item.pricePerTokenUsd * item.tokenCount, currencyLocale)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
                <Link
                  href="/marketplace"
                  className="mt-[1mm] inline-flex text-xs font-semibold text-terminal-primary hover:underline"
                >
                  {c.addMoreTokens}
                </Link>
              </div>
            )
          ) : (
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
              <label className="text-xs font-medium uppercase tracking-wider text-terminal-muted">{c.depositAmountUsd}</label>
              <input
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                inputMode="decimal"
                className="mt-2 w-full rounded-lg border border-terminal-border bg-terminal-card px-3 py-2.5 text-right font-mono text-lg text-terminal-text outline-none focus:border-terminal-primary/50"
                placeholder="100"
              />
            </div>
          )}

          {showPaymentMethods ? (
            <div className="border-b border-terminal-border pt-[2mm] pb-0">
              <p className="text-sm font-bold text-terminal-text">{c.feesSummaryTitle}</p>
              <div className="mt-[1mm] space-y-0 text-xs text-terminal-muted">
                <div className={COMPACT_ROW}>
                  <span>{mode === 'deposit' ? c.totalDepositUsd : c.subtotalUsdc}</span>
                  <span className={`${AMOUNT_RIGHT} text-terminal-text`}>
                    {mode === 'deposit'
                      ? formatUsd2(totalUsd, currencyLocale)
                      : formatUsdc2(totalUsd, currencyLocale)}
                  </span>
                </div>
                {mode === 'purchase' && feePreviewOption ? (
                  <>
                    <div className={COMPACT_ROW}>
                      <span>{c.feeCommission}</span>
                      <span className={`${AMOUNT_RIGHT} text-terminal-text`}>
                        {formatMoneyAmount(feePreviewOption.platformFeeUsd, feesUseUsdc, currencyLocale)}
                      </span>
                    </div>
                    <div className={COMPACT_ROW}>
                      <span>{c.feeGas}</span>
                      <span className={`${AMOUNT_RIGHT} text-terminal-text`}>
                        {formatMoneyAmount(feePreviewOption.gasFeeUsd, feesUseUsdc, currencyLocale)}
                      </span>
                    </div>
                    <div className={COMPACT_ROW}>
                      <span>{c.feeOther}</span>
                      <span className={`${AMOUNT_RIGHT} text-terminal-text`}>
                        {formatMoneyAmount(feePreviewOption.networkFeeUsd, feesUseUsdc, currencyLocale)}
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {showPaymentMethods ? (
            <div className="pt-0 pb-[2mm]">
              <div className={COMPACT_ROW}>
                <span className="text-sm font-semibold text-terminal-text">{c.totalToPayLabel}</span>
                <span className={`${AMOUNT_RIGHT} text-base font-bold text-terminal-primary`}>
                  {formatMoneyAmount(displayTotalUsd, feesUseUsdc, currencyLocale)}
                </span>
              </div>
            </div>
          ) : null}

          {showPaymentMethods ? (
            <div className="mb-[1mm] mt-0">
              <PaymentMethodLogosButton
                label={c.selectPaymentMethod}
                expanded={paymentMethodsExpanded}
                onClick={() => setPaymentMethodsExpanded((open) => !open)}
                disabled={sortedDepositOptions.length === 0}
              />
            </div>
          ) : null}

          {showPaymentMethods && paymentMethodsExpanded ? (
            <div className="space-y-[1mm] pb-[2mm]">
              {paymentQuoteExpired ? (
                <p className="text-xs text-terminal-warning">{c.quoteExpired}</p>
              ) : null}
              {sortedDepositOptions.some((row) => row.groupId === 'linked_wallet' && row.configured) ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
                  <p className="font-semibold">{c.usdcEducationTitle}</p>
                  <p className="mt-1 text-emerald-800">{c.usdcEducationBody}</p>
                </div>
              ) : null}
              {depositCountry === 'AR' ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
                  <p className="font-semibold">{c.argentinaPaymentsTitle}</p>
                  <p className="mt-1 text-sky-800">{c.argentinaPaymentsBody}</p>
                </div>
              ) : null}
              {paymentGroups.map((group) => (
                <div key={group.id}>
                  <p className="py-[1mm] text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
                    {c.paymentGroups[group.id]}
                    {group.id === 'global_cards' ? (
                      <span className="ml-1 normal-case text-terminal-muted/80">— {c.globalCardsHint}</span>
                    ) : null}
                  </p>
                  {group.available.length > 0 ? (
                    <div className="divide-y divide-terminal-border overflow-hidden rounded-lg border border-terminal-border bg-white">
                      {group.available.map((option) => renderDepositOption(option))}
                    </div>
                  ) : null}
                  {group.unavailable.length > 0 ? (
                    <div className="mt-[1mm] space-y-[1mm]">
                      {group.available.length > 0 ? (
                        <p className="text-[10px] font-medium uppercase tracking-wide text-terminal-muted/80">
                          {c.paymentMethodsUnavailable}
                        </p>
                      ) : null}
                      <div className="divide-y divide-terminal-border overflow-hidden rounded-lg border border-dashed border-terminal-border bg-white">
                        {group.unavailable.map((option) => renderDepositOption(option))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              {sortedDepositOptions.length === 0 && totalUsd > 0 ? (
                <p className="text-xs text-terminal-muted">{c.processing}</p>
              ) : null}
              {sortedDepositOptions.length === 0 && totalUsd <= 0 ? (
                <p className="text-xs text-terminal-warning">{c.invalidAmount}</p>
              ) : null}
            </div>
          ) : null}

          {mode === 'deposit' &&
          requiresWallet &&
          stablecoinNetworkOptions.length > 1 &&
          status !== 'pending_gateway' ? (
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
                {c.networkLabel}
              </label>
              <select
                value={stablecoinNetwork}
                onChange={(event) => setStablecoinNetwork(event.target.value)}
                className="mt-1 w-full rounded-lg border border-terminal-border bg-white px-3 py-2 text-sm text-terminal-text"
              >
                {stablecoinNetworkOptions.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.label}
                    {network.cheapestRank === 1 ? ` (${c.recommendedBadge})` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-terminal-muted">{c.usdcNetworkDepositHint}</p>
            </div>
          ) : null}

          {showWalletLinker ? (
            <div className="py-[2mm]">
              <InvestorWalletLinker
                variant="checkout"
                allowReplace
                onError={(message) => setError(message)}
                onLinked={() => {
                  void loadDepositQuote();
                }}
              />
            </div>
          ) : null}

          {mode === 'deposit' &&
          requiresWallet &&
          linkedWalletAddress &&
          status === 'manual' &&
          payToAddress ? (
            <p className="text-xs text-terminal-muted">
              {formatMessage(c.depositFromLinkedWalletHint, {
                address: `${linkedWalletAddress.slice(0, 6)}…${linkedWalletAddress.slice(-4)}`
              })}
            </p>
          ) : null}

          {status === 'pending_gateway' && pendingReference ? (
            <div className="space-y-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-3 text-sm text-terminal-text">
              <p className="font-semibold text-terminal-primary">
                {isWisePending
                  ? c.wisePendingTitle
                  : isRipioPending
                    ? 'Transferencia Ripio pendiente'
                    : c.localRailPendingTitle}
              </p>
              <p className="text-xs text-terminal-muted">
                {isWisePending
                  ? formatMessage(c.wisePendingBody, { reference: pendingReference })
                  : isRipioPending
                    ? 'Transfiere el monto en ARS con las instrucciones de abajo. Acreditamos USDC en tu wallet cuando Ripio confirme el depósito.'
                    : formatMessage(mode === 'deposit' ? c.localRailPendingBody : c.localRailPendingPurchase, {
                        method: selectedDepositOption?.label ?? paymentMethod,
                        reference: pendingReference
                      })}
              </p>
              {isWisePending && pendingManualMeta?.instructions ? (
                <pre className="whitespace-pre-wrap rounded border border-terminal-border bg-white p-3 text-[11px] font-mono text-terminal-text">
                  {String(pendingManualMeta.instructions)}
                </pre>
              ) : null}
              {isRipioPending && pendingManualMeta?.instructions ? (
                <pre className="whitespace-pre-wrap rounded border border-terminal-border bg-white p-3 text-[11px] font-mono text-terminal-text">
                  {String(pendingManualMeta.instructions)}
                </pre>
              ) : null}
              {isWisePending ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-terminal-primary">
                  {formatMessage(c.wiseReferenceLabel, { reference: pendingReference })}
                </p>
              ) : null}
              <Link
                href={mode === 'deposit' ? '/dashboard/portfolio' : '/dashboard/portfolio'}
                className="inline-flex rounded-lg bg-terminal-primary px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                {mode === 'deposit' ? c.backToWallet : t.checkout.viewPortfolio}
              </Link>
            </div>
          ) : null}

          {status === 'done' || status === 'share_pending' || status === 'share_failed' ? (
            <div
              className={`space-y-3 rounded-lg border px-4 py-3 text-sm ${
                status === 'share_failed'
                  ? 'border-terminal-warning/30 bg-terminal-warning/10 text-terminal-warning'
                  : status === 'share_pending'
                    ? 'border-terminal-primary/30 bg-terminal-primary/10 text-terminal-text'
                    : 'border-terminal-success/30 bg-terminal-success/10 text-terminal-success'
              }`}
            >
              <p className="font-semibold">
                {status === 'share_failed'
                  ? t.checkout.purchaseSharesFailed
                  : status === 'share_pending'
                    ? t.checkout.purchaseSharesPending
                    : mode === 'deposit'
                      ? c.depositComplete
                      : c.purchaseComplete}
              </p>
              {status === 'share_failed' ? (
                <p className="text-xs">{t.checkout.purchaseSharesFailedHint}</p>
              ) : null}
              {status !== 'share_failed' ? (
                <Link
                  href="/dashboard/portfolio"
                  className="inline-flex rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  {mode === 'deposit' ? c.backToWallet : t.checkout.viewPortfolio}
                </Link>
              ) : null}
            </div>
          ) : null}

          {status === 'mercadopago_embedded' && embeddedSession && embeddedReference ? (
            <MercadoPagoWalletBrick
              session={embeddedSession}
              externalReference={embeddedReference}
              amountUsd={totalUsd}
              batchId={batchId}
              onApproved={handleEmbeddedApproved}
              onPending={handleEmbeddedPending}
              onError={(message) => {
                setError(message);
                setStatus('mercadopago_embedded');
              }}
            />
          ) : null}

          {status === 'manual' && payToAddress ? (
            <div className="space-y-2 rounded-lg border border-terminal-warning/30 bg-terminal-warning/10 p-4 text-xs text-terminal-muted">
              <p>{t.checkout.sendToCompartment}</p>
              {mode === 'purchase' ? (
                <p className="text-terminal-text">{t.checkout.investorTreasuryUsdcNote}</p>
              ) : null}
              <p className="break-all font-mono text-terminal-text">{payToAddress}</p>
              <input
                value={manualTxHash}
                onChange={(event) => setManualTxHash(event.target.value)}
                placeholder={c.txHashPlaceholder}
                className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
              />
              <button
                type="button"
                onClick={() => void (mode === 'deposit' ? verifyDepositTx() : verifyUsdcPayment())}
                className="rounded-lg bg-terminal-primary px-3 py-2 text-xs font-semibold text-white"
              >
                {c.verifyTx}
              </button>
            </div>
          ) : null}

          {checkout?.providerCheckoutUrl &&
          status !== 'done' &&
          status !== 'share_pending' &&
          status !== 'share_failed' ? (
            <a
              href={checkout.providerCheckoutUrl}
              className="inline-flex items-center gap-1 text-sm text-terminal-primary"
              target="_blank"
              rel="noreferrer"
            >
              {c.openGateway} <ExternalLink size={12} />
            </a>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-terminal-warning/40 bg-terminal-warning/10 px-3 py-2 text-xs text-terminal-warning">
              {error}
            </p>
          ) : null}

          {status !== 'done' &&
          status !== 'share_pending' &&
          status !== 'share_failed' &&
          status !== 'mercadopago_embedded' ? (
            <div className={`${showPaymentMethods ? 'space-y-1' : ''} hidden md:block`}>
              <button
                type="button"
                disabled={confirmDisabled}
                onClick={() => void handleConfirm()}
                className="w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmLabel}
              </button>
              {showPaymentMethods && quoteExpiresAt && quoteSecondsLeft > 0 ? (
                <p className="text-right text-xs font-medium text-terminal-primary">
                  {formatMessage(c.quoteExpiresIn, { seconds: String(quoteSecondsLeft) })}
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === 'purchase' && items.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                clearCart();
                router.push('/marketplace');
              }}
              className="w-full rounded-lg border border-terminal-border px-4 py-2 text-sm text-terminal-muted hover:text-terminal-text"
            >
              {c.clearCart}
            </button>
          ) : null}
        </div>
      </article>

      {status !== 'done' && status !== 'share_pending' && status !== 'share_failed' ? (
        <StickyActionBar
          summary={
            <div className="flex items-center justify-between text-sm">
              <span className="text-terminal-muted">{mode === 'deposit' ? c.depositTitle : c.purchaseTitle}</span>
              <span className="font-mono font-semibold text-terminal-primary">
                {formatUsd(totalUsd)}
              </span>
            </div>
          }
        >
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={() => void handleConfirm()}
            className="min-h-12 w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </StickyActionBar>
      ) : null}
    </section>
  );
}
