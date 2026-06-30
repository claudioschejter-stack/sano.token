'use client';

import { ArrowLeft, ExternalLink, ShoppingCart, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
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
import { isLocalRailManualResult, isPendingManualGatewayResult, isPrivyClientFundResult, isRipioOnRampResult, isWiseManualResult } from '../../lib/payments/stripeCheckoutOptions';
import { fetchMarketplaceFeedClient } from '../../lib/marketplaceApi';
import { useCartStore } from '../../store/useCartStore';
import type { PublicPaymentIntent } from '../../lib/payments/paymentService';
import { InvestorWalletLinker } from '../wallet/InvestorWalletLinker';
import { StickyActionBar } from '../mobile/StickyActionBar';
import { CheckoutPaymentLaneSelector } from '../payments/CheckoutPaymentLaneSelector';
import { useCheckoutPaymentCountry } from '../../hooks/useCheckoutPaymentCountry';
import {
  buildCheckoutPaymentLaneBundle,
  defaultOptionIdForLane,
  type CheckoutPaymentLaneId
} from '../../lib/payments/checkoutPaymentLanes';
import { WalletConnectConnectButton } from '../wallet/WalletConnectConnectButton';
import { WalletCheckoutConnectButton } from '../wallet/WalletCheckoutConnectButton';
import { PrivyWalletCheckoutButton } from '../wallet/PrivyWalletCheckoutButton';
import { PrivyOnRampFundPanel } from '../payments/PrivyOnRampFundPanel';
import { usePrivyWalletLink } from '../../hooks/usePrivyWalletLink';
import { BASE_CHAIN_ID } from '../../lib/web3/config';
import { connectCheckoutWallet } from '../../lib/web3/connectCheckoutWallet';
import type { CheckoutWalletOptionId } from '../../lib/web3/walletConnectors';
import { pickCoinbaseConnector } from '../../lib/web3/walletConnectors';
import {
  autoConnectWalletOptionId,
  buildCheckoutDisplaySections,
  buildFiatOnRampDisplayId,
  FIAT_ON_RAMP_SOURCE_IDS,
  isWalletUsdcCheckoutOption,
  parseFiatOnRampDisplayId,
  resolveCheckoutPaymentSelection,
  RIPIO_EWALLET_PARENT_ID,
  RIPIO_EWALLET_RAILS
} from '../../lib/payments/checkoutPaymentDisplay';
import { useUsdcTreasuryPayment } from '../../hooks/useUsdcTreasuryPayment';
import { usePrivyTreasuryPayment } from '../../hooks/usePrivyTreasuryPayment';
import { usePrivyVaultDeposit } from '../../hooks/usePrivyVaultDeposit';
import type { VaultDepositLine } from '../../lib/web3/vaultDepositPayment';
import { isEvmAutoUsdcNetwork } from '../../lib/web3/usdcTreasuryTransfer';
import { vaultShareDeliveryUiState } from '../../lib/payments/vaultShareDeliveryStatus';
import {
  isMercadoPagoEmbeddedResult,
  MERCADOPAGO_WALLET_OPTION_ID,
  type MercadoPagoEmbeddedSession
} from '../../lib/payments/mercadoPagoEmbeddedService';
import { MercadoPagoWalletBrick } from '../payments/MercadoPagoWalletBrick';
import { PaymentGateway } from '../payments/gateway';
import { SimplifiedCheckout } from '../payments/simplified';

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
  presentation?: {
    tokenAmountUsdc: number;
    bestOptionId: string | null;
    headline: string;
    subheadline: string;
    feeDisclosure: string;
    showAlternativesLabel: string;
  };
  stablecoinNetworks?: Array<{ id: string; label: string; symbol: string; cheapestRank: number }>;
};

function formatUsdc2(amount: number, locale: string): string {
  return `USDC ${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsdcAmountNumber(amount: number, locale: string): string {
  return amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
const AMOUNT_ROW = 'grid grid-cols-[minmax(0,1fr)_11rem] items-baseline gap-x-3 py-[1mm]';
const AMOUNT_VALUE_CELL = 'text-right font-mono tabular-nums';
const AMOUNT_TOTAL = 'text-base font-bold';
const AMOUNT_CREDIT_LABEL = 'whitespace-nowrap text-[0.825rem] font-semibold uppercase tracking-wider text-terminal-muted sm:text-sm';
const AMOUNT_CREDIT_VALUE = 'text-[1.1rem] font-bold';
const USDC_AMOUNT_GAP = 'mr-[5mm] shrink-0';
const AMOUNT_NUMBER_WIDTH = 'w-[6.5rem] text-right';
const AMOUNT_RIGHT = AMOUNT_VALUE_CELL;
const SECTION_TITLE = 'my-[1mm] py-0 text-[10px] font-semibold uppercase tracking-wide text-terminal-muted';

function formatDepositLocal(amount: number, currencyCode: string, intlLocale: string) {
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0
  }).format(amount);
}


function buildVaultDepositsFromIntents(intents: PublicPaymentIntent[] | undefined): VaultDepositLine[] {
  if (!intents?.length) {
    return [];
  }

  return intents.flatMap((row) => {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    if (metadata.purchaseMode !== 'ERC4626_DEPOSIT' || typeof metadata.vaultAddress !== 'string') {
      return [];
    }
    const amountUsd = Number.parseFloat(row.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return [];
    }
    return [{ vaultAddress: metadata.vaultAddress, amountUsd }];
  });
}

function normalizeSelectableDepositOptionId(id: string | null): string | null {
  if (!id) {
    return null;
  }
  if (FIAT_ON_RAMP_SOURCE_IDS.includes(id as (typeof FIAT_ON_RAMP_SOURCE_IDS)[number])) {
    return buildFiatOnRampDisplayId('international_transfer');
  }
  return id;
}

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
  const { connectAsync, connectors, reset: resetConnect } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const walletGuard = useLinkedWalletGuard();
  const { payToTreasury } = useUsdcTreasuryPayment();
  const { payToTreasury: payToTreasuryPrivy } = usePrivyTreasuryPayment();
  const { depositToVaults: depositToVaultsPrivy } = usePrivyVaultDeposit();
  const { linkPrivyWallet } = usePrivyWalletLink();

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
  const depositReturnTo = searchParams.get('returnTo')?.trim() || '/dashboard/inversiones';

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
    | 'pending_privy'
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
  const [paymentMethodsExpanded] = useState(true);
  const [paymentLane, setPaymentLane] = useState<CheckoutPaymentLaneId | null>(null);
  const [ripioEwalletRail, setRipioEwalletRail] = useState<string | null>(null);
  const [paymentGatewayTabActive] = useState(true);

  const totalUsd = mode === 'deposit' ? Number(depositAmount) || 0 : cartTotalUsd;
  const privyVaultDeposits = useMemo(
    () => buildVaultDepositsFromIntents(checkout?.paymentIntents),
    [checkout?.paymentIntents]
  );
  const usesPrivyVaultDeposit = privyVaultDeposits.length > 0;
  const depositCountry = useCheckoutPaymentCountry(currency);
  const sortedDepositOptions = useMemo(() => sortDepositPaymentOptions(depositOptions), [depositOptions]);
  const paymentGroups = useMemo(
    () => (depositOptionGroups.length > 0 ? depositOptionGroups : groupDepositPaymentOptions(depositOptions)),
    [depositOptionGroups, depositOptions]
  );

  const paymentDisplaySections = useMemo(
    () =>
      buildCheckoutDisplaySections(sortedDepositOptions, {
        international_transfer: c.fiatIntlTransfer,
        debit_card: c.fiatDebitCard,
        credit_card: c.fiatCreditCard
      }),
    [sortedDepositOptions, c.fiatIntlTransfer, c.fiatDebitCard, c.fiatCreditCard]
  );
  const paymentLaneBundle = useMemo(
    () =>
      buildCheckoutPaymentLaneBundle({
        options: sortedDepositOptions,
        country: depositCountry,
        fiatOnRampLabels: {
          international_transfer: c.fiatIntlTransfer,
          debit_card: c.fiatDebitCard,
          credit_card: c.fiatCreditCard
        }
      }),
    [
      c.fiatCreditCard,
      c.fiatDebitCard,
      c.fiatIntlTransfer,
      depositCountry,
      sortedDepositOptions
    ]
  );
  const resolvedPaymentSelection = useMemo(
    () =>
      resolveCheckoutPaymentSelection(
        selectedDepositOptionId,
        paymentDisplaySections.fiatOnRampBaseOption?.id ?? null,
        ripioEwalletRail
      ),
    [selectedDepositOptionId, paymentDisplaySections.fiatOnRampBaseOption?.id, ripioEwalletRail]
  );
  const selectedDepositOption = useMemo(() => {
    const optionId = resolvedPaymentSelection.paymentOptionId;
    return optionId ? sortedDepositOptions.find((row) => row.id === optionId) ?? null : null;
  }, [resolvedPaymentSelection.paymentOptionId, sortedDepositOptions]);
  const showPaymentMethods =
    (mode === 'deposit' && totalUsd > 0) || (mode === 'purchase' && items.length > 0);
  const requiresWallet =
    selectedDepositOption?.method === 'CUSTODIAL_STABLECOIN' ||
    selectedDepositOption?.method === 'USDC_ONCHAIN';
  const isWalletConnectUsdc = selectedDepositOptionId === 'walletconnect_usdc';
  const isWalletConnectSession =
    isConnected &&
    (connector?.id === 'walletConnect' || connector?.type === 'walletConnect');
  const showWalletLinker =
    requiresWallet &&
    mode !== 'deposit' &&
    !isWalletConnectUsdc &&
    !autoConnectWalletOptionId(selectedDepositOptionId);
  const linkedWalletAddress = walletGuard.linkedWallet;
  const paymentQuoteExpired = showPaymentMethods && quoteSecondsLeft <= 0 && quoteExpiresAt !== null;

  const connectWalletForSelectedOption = useCallback(async (): Promise<string | null> => {
    if (selectedDepositOptionId === 'privy_usdc') {
      return (await linkPrivyWallet()) ?? address ?? null;
    }
    if (!autoConnectWalletOptionId(selectedDepositOptionId)) {
      return address ?? null;
    }

    try {
      return await connectCheckoutWallet({
        optionId: selectedDepositOptionId as CheckoutWalletOptionId,
        connectors,
        connectAsync,
        disconnectAsync,
        isConnected,
        activeConnectorId: connector?.id,
        resetConnect,
        switchChainAsync
      });
    } catch {
      return address ?? null;
    }
  }, [
    address,
    connectAsync,
    connector?.id,
    connectors,
    disconnectAsync,
    isConnected,
    resetConnect,
    selectedDepositOptionId,
    switchChainAsync,
    linkPrivyWallet
  ]);

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
      `/api/marketplace/cart/deposit-options?amountUsd=${encodeURIComponent(String(totalUsd))}&country=${encodeURIComponent(depositCountry)}&fxRate=${encodeURIComponent(String(fxRate))}&mode=${encodeURIComponent(mode)}`,
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
          if (current) {
            const fiatRail = parseFiatOnRampDisplayId(current);
            if (fiatRail) {
              const hasFiatProvider = next.some(
                (row) =>
                  FIAT_ON_RAMP_SOURCE_IDS.includes(row.id as (typeof FIAT_ON_RAMP_SOURCE_IDS)[number]) &&
                  row.configured
              );
              if (hasFiatProvider) {
                return current;
              }
            } else if (next.some((row) => row.id === current && row.configured)) {
              return current;
            }
          }
          const recommended = data?.recommendedOptionId;
          if (recommended && next.some((row) => row.id === recommended && row.configured)) {
            return normalizeSelectableDepositOptionId(recommended);
          }
          const fallback = next.find((row) => row.configured)?.id ?? null;
          return normalizeSelectableDepositOptionId(fallback);
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
  }, [currency, depositCountry, mode, rates, totalUsd]);

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

    if (showPaymentMethods && selectedDepositOptionId === RIPIO_EWALLET_PARENT_ID && !ripioEwalletRail) {
      setError(c.ripioEwalletTitle);
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
        } else if (
          !autoConnectWalletOptionId(selectedDepositOptionId) &&
          (!walletGuard.canSignOnChain || !address)
        ) {
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

    let connectedPayer: string | null = address ?? null;
    if (autoConnectWalletOptionId(selectedDepositOptionId)) {
      connectedPayer = (await connectWalletForSelectedOption()) ?? connectedPayer;
      if (mode === 'purchase' && connectedPayer && linkedWalletAddress) {
        if (connectedPayer.toLowerCase() !== linkedWalletAddress.toLowerCase()) {
          setError(w.walletMismatch);
          setStatus('idle');
          return;
        }
      }
    }

    try {
      if (mode === 'deposit') {
        const response = await fetch('/api/wallet/deposit-intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountUsd: totalUsd,
            method: paymentMethod,
            paymentOptionId: resolvedPaymentSelection.paymentOptionId,
            auto: false,
            stablecoinNetwork,
            walletAddress: linkedWalletAddress,
            paymentOptionRail: resolvedPaymentSelection.paymentOptionRail ?? undefined
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
          const autoPaid = await attemptAutoUsdcTreasuryPayment(totalUsd, { depositId: data.deposit.id });
          if (!autoPaid) {
            setStatus('manual');
          }
          return;
        }

        if (isPrivyClientFundResult(providerMeta)) {
          setPendingReference(data.deposit.id);
          setStatus('pending_privy');
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
          paymentOptionId: resolvedPaymentSelection.paymentOptionId,
          walletAddress: isWalletConnectUsdc ? linkedWalletAddress : connectedPayer ?? address,
          stablecoinNetwork,
          paymentOptionRail: resolvedPaymentSelection.paymentOptionRail ?? undefined
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

      const purchaseGatewayMeta = (data.checkout.paymentIntents?.[0]?.metadata as Record<string, unknown> | undefined)
        ?.gateway as Record<string, unknown> | undefined;
      if (isPrivyClientFundResult(purchaseGatewayMeta)) {
        setPendingReference(data.checkout.batchId);
        setStatus('pending_privy');
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
        const checkoutTotalUsd = Number(data.checkout.totalUsd);
        const autoPaid = await attemptAutoUsdcTreasuryPayment(
          Number.isFinite(checkoutTotalUsd) && checkoutTotalUsd > 0 ? checkoutTotalUsd : totalUsd,
          { activeBatchId: data.checkout.batchId }
        );
        if (!autoPaid) {
          setStatus('manual');
        }
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

  const verifyUsdcPayment = async (txHashOverride?: string) => {
    const hash = (txHashOverride ?? manualTxHash).trim();
    if (!batchId || !hash) {
      return;
    }

    setStatus('verifying');
    setError(null);

    const response = await fetch('/api/marketplace/cart/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        txHash: hash,
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

  const verifyDepositTx = async (txHashOverride?: string) => {
    const hash = (txHashOverride ?? manualTxHash).trim();
    if (!deposit || !hash) {
      return;
    }

    setStatus('verifying');
    setError(null);

    const response = await fetch('/api/wallet/deposit-intents/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depositId: deposit.id,
        txHash: hash,
        walletAddress: linkedWalletAddress ?? address ?? undefined
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

  const attemptAutoUsdcTreasuryPayment = async (
    amountUsd: number,
    context?: { depositId?: string; activeBatchId?: string }
  ): Promise<boolean> => {
    if (
      !isWalletUsdcCheckoutOption(selectedDepositOptionId) ||
      !isEvmAutoUsdcNetwork(stablecoinNetwork) ||
      (paymentMethod !== 'USDC_ONCHAIN' && paymentMethod !== 'CUSTODIAL_STABLECOIN')
    ) {
      return false;
    }

    let payer: string | null = address ?? null;
    if (!payer) {
      payer = await connectWalletForSelectedOption();
    }
    if (!payer) {
      return false;
    }

    try {
      setStatus('processing');
      const txHash =
        selectedDepositOptionId === 'privy_usdc' && usesPrivyVaultDeposit
          ? await depositToVaultsPrivy({ stablecoinNetwork, deposits: privyVaultDeposits })
          : selectedDepositOptionId === 'privy_usdc'
            ? await payToTreasuryPrivy({ amountUsd, stablecoinNetwork })
            : await payToTreasury({ amountUsd, stablecoinNetwork });
      setManualTxHash(txHash);
      if (mode === 'deposit' && context?.depositId) {
        setStatus('verifying');
        setError(null);
        const response = await fetch('/api/wallet/deposit-intents/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            depositId: context.depositId,
            txHash,
            walletAddress: linkedWalletAddress ?? payer
          })
        });
        const verifyData = (await response.json()) as { error?: string; deposit?: DepositResponse };
        if (!response.ok || !verifyData.deposit) {
          setError(verifyData.error ?? 'STABLECOIN_VERIFY_FAILED');
          setStatus('manual');
          return false;
        }
        setDeposit(verifyData.deposit);
        setStatus('done');
        return true;
      }
      if (mode === 'purchase' && context?.activeBatchId) {
        setStatus('verifying');
        setError(null);
        const response = await fetch('/api/marketplace/cart/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: context.activeBatchId,
            txHash,
            walletAddress: isWalletConnectUsdc ? linkedWalletAddress ?? payer : payer
          })
        });
        const verifyData = (await response.json()) as {
          error?: string;
          paymentIntents?: PublicPaymentIntent[];
        };
        if (!response.ok) {
          setError(verifyData.error ?? 'STABLECOIN_VERIFY_FAILED');
          setStatus('manual');
          return false;
        }
        clearCart();
        applyCartPostPurchaseStatus(verifyData.paymentIntents ?? []);
        void fetch('/api/portfolio/aggregate?snapshot=true', { cache: 'no-store' });
        return true;
      }
    } catch (autoPayError) {
      const message = autoPayError instanceof Error ? autoPayError.message : 'USDC_AUTO_PAY_FAILED';
      if (message !== 'WALLET_NOT_CONNECTED') {
        setError(message);
      }
    }

    return false;
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

  const renderDepositOption = (option: DepositPaymentOption, displayLabel?: string) => {
    const selected = selectedDepositOptionId === option.id;
    const isFiatOnRampDisplay = parseFiatOnRampDisplayId(option.id) !== null;
    const amountPrimary = isFiatOnRampDisplay
      ? formatUsd2(option.totalUsd, currencyLocale)
      : option.usesLocalCurrency && option.totalLocal != null
        ? formatDepositLocal(option.totalLocal, option.displayCurrency, intlLocale)
        : formatUsdc2(option.totalUsd, currencyLocale);

    return (
      <div key={option.id} className={`bg-white ${!option.configured ? 'opacity-70' : ''}`}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSelectedDepositOptionId(option.id);
            if (option.id !== RIPIO_EWALLET_PARENT_ID) {
              setRipioEwalletRail(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setSelectedDepositOptionId(option.id);
              if (option.id !== RIPIO_EWALLET_PARENT_ID) {
                setRipioEwalletRail(null);
              }
            }
          }}
          className={`flex w-full cursor-pointer items-center gap-2 px-3 py-[1mm] text-left transition-colors ${
            selected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
          }`}
        >
          <div className="min-w-0 flex-1">
            <span className="block text-[120%] font-semibold leading-tight text-slate-900">
              {displayLabel ?? option.label}
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
            ) : option.method === 'MERCADO_PAGO' || option.method === 'LOCAL_RAIL' || option.method === 'RIPIO' ? (
              <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">
                {c.electronicWalletLocalHint}
              </span>
            ) : isFiatOnRampDisplay ? (
              <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">{c.fiatOnRampChargeHint}</span>
            ) : optionUsesUsdc(option) ? (
              <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">{c.multichainUsdcHint}</span>
            ) : option.id === 'mercadopago_wallet' ? (
              <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">
                Pagás con saldo MP desde el checkout embebido de Mercado Pago
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
            aria-label={displayLabel ?? option.label}
            aria-pressed={selected}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedDepositOptionId(option.id);
              if (option.id !== RIPIO_EWALLET_PARENT_ID) {
                setRipioEwalletRail(null);
              }
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
                <WalletConnectConnectButton />
                {isWalletConnectSession && address ? (
                  <p className="font-mono text-[10px] text-emerald-700">
                    {formatMessage(c.walletConnectPayingFromShort, {
                      address: `${address.slice(0, 6)}…${address.slice(-4)}`
                    })}
                  </p>
                ) : null}
              </div>
            ) : option.id === 'privy_usdc' ? (
              <div className="py-[1mm]">
                <PrivyWalletCheckoutButton onLinked={() => void loadDepositQuote()} />
              </div>
            ) : autoConnectWalletOptionId(option.id) ? (
              <div className="py-[1mm]">
                <WalletCheckoutConnectButton
                  optionId={option.id as CheckoutWalletOptionId}
                  walletLabel={displayLabel ?? option.label}
                />
              </div>
            ) : null}
            {option.id === RIPIO_EWALLET_PARENT_ID ? (
              <div className="py-[1mm]">
                <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">{c.ripioEwalletTitle}</p>
                <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {RIPIO_EWALLET_RAILS.map((wallet) => {
                    const railSelected = ripioEwalletRail === wallet.rail;
                    return (
                      <button
                        key={wallet.rail}
                        type="button"
                        onClick={() => setRipioEwalletRail(wallet.rail)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                          railSelected ? 'bg-blue-50 font-semibold text-blue-900' : 'text-slate-800'
                        }`}
                      >
                        <span>{wallet.label}</span>
                        {railSelected ? <span className="text-[10px] uppercase text-blue-700">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const displayTotalUsd = selectedDepositOption?.totalUsd ?? sortedDepositOptions.find((o) => o.configured)?.totalUsd ?? totalUsd;
  const greetingName = investorFirstName(investorName);

  const confirmDisabled =
    (status !== 'idle' && status !== 'manual') ||
    (mode === 'purchase' && items.length === 0) ||
    (showPaymentMethods && paymentQuoteExpired) ||
    (showPaymentMethods && !paymentLane) ||
    (showPaymentMethods && !selectedDepositOptionId) ||
    (requiresWallet &&
      selectedDepositOptionId &&
      (mode === 'deposit'
        ? !walletGuard.isWalletLinked
        : isWalletConnectUsdc
          ? !walletGuard.isWalletLinked || !isWalletConnectSession
          : autoConnectWalletOptionId(selectedDepositOptionId)
            ? !walletGuard.isWalletLinked
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
          href={mode === 'deposit' ? depositReturnTo : '/marketplace'}
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
          ) : null}

          {showPaymentMethods ? (
            <div className="border-b border-terminal-border py-[1mm]">
              <div className={AMOUNT_ROW}>
                <label className={mode === 'deposit' ? AMOUNT_CREDIT_LABEL : 'text-xs font-semibold uppercase tracking-wider text-terminal-muted'}>
                  {c.creditAmountUsdc}
                </label>
                {mode === 'deposit' ? (
                  <div className={`${AMOUNT_VALUE_CELL} ${AMOUNT_CREDIT_VALUE} flex items-baseline justify-end text-white`}>
                    <span className={USDC_AMOUNT_GAP}>USDC</span>
                    <input
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(event.target.value)}
                      inputMode="decimal"
                      className={`${AMOUNT_NUMBER_WIDTH} border-0 bg-transparent p-0 text-white outline-none focus:ring-0`}
                      placeholder="100"
                    />
                  </div>
                ) : (
                  <div className={`${AMOUNT_VALUE_CELL} ${AMOUNT_TOTAL} flex items-baseline justify-end text-white`}>
                    <span className={USDC_AMOUNT_GAP}>USDC</span>
                    <span className={AMOUNT_NUMBER_WIDTH}>{formatUsdcAmountNumber(totalUsd, currencyLocale)}</span>
                  </div>
                )}
              </div>
              <div className={AMOUNT_ROW}>
                <span className="text-sm font-semibold text-terminal-text">{c.totalToPayLabel}</span>
                {mode !== 'deposit' && (
                  <div className={`${AMOUNT_VALUE_CELL} ${AMOUNT_TOTAL} flex items-baseline justify-end text-terminal-primary`}>
                    <span className={USDC_AMOUNT_GAP}>USDC</span>
                    <span className={AMOUNT_NUMBER_WIDTH}>{formatUsdcAmountNumber(displayTotalUsd, currencyLocale)}</span>
                  </div>
                )}
              </div>
              {mode !== 'deposit' && (
                <p className="mt-0.5 text-[10px] text-terminal-muted">{c.totalToPayFeesIncluded}</p>
              )}
            </div>
          ) : mode === 'deposit' ? (
            <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4 py-[1mm]">
              <div className={AMOUNT_ROW}>
                <label className={AMOUNT_CREDIT_LABEL}>{c.creditAmountUsdc}</label>
                <div className={`${AMOUNT_VALUE_CELL} ${AMOUNT_CREDIT_VALUE} flex items-baseline justify-end text-white`}>
                  <span className={USDC_AMOUNT_GAP}>USDC</span>
                  <input
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    inputMode="decimal"
                    className={`${AMOUNT_NUMBER_WIDTH} border-0 bg-transparent p-0 text-white outline-none focus:ring-0`}
                    placeholder="100"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {showPaymentMethods && !paymentGatewayTabActive ? (
            <div className="mb-[1mm] mt-[1mm]">
              <p className={SECTION_TITLE}>{c.selectPaymentMethod}</p>
            </div>
          ) : null}

          {showPaymentMethods && paymentMethodsExpanded && paymentGatewayTabActive ? (
            <SimplifiedCheckout
              amountUsd={totalUsd}
              referenceId={deposit?.id ?? batchId ?? ''}
              investorName={investorName}
              country={depositCountry}
              className="py-[1mm]"
              onFunded={() => setStatus('done')}
              onError={(message) => setError(message)}
            />
          ) : null}

          {showPaymentMethods && paymentMethodsExpanded && !paymentGatewayTabActive ? (
            <CheckoutPaymentLaneSelector
              bundle={paymentLaneBundle}
              selectedLane={paymentLane}
              onSelectLane={(laneId) => {
                setPaymentLane(laneId);
                if (!laneId) {
                  return;
                }
                const nextOptionId = defaultOptionIdForLane(laneId, paymentLaneBundle);
                if (nextOptionId) {
                  setSelectedDepositOptionId(nextOptionId);
                }
                if (laneId !== 'electronic_wallet') {
                  setRipioEwalletRail(null);
                }
              }}
              ripioEwalletRail={ripioEwalletRail}
              onSelectRipioRail={(rail) => {
                setRipioEwalletRail(rail);
                setSelectedDepositOptionId(RIPIO_EWALLET_PARENT_ID);
              }}
              ripioRails={RIPIO_EWALLET_RAILS}
              labels={{
                countryDetected: c.paymentCountryDetected,
                countryHint: c.paymentCountryHint,
                laneElectronicWallet: c.paymentLaneElectronicWallet,
                laneElectronicWalletDesc: c.paymentLaneElectronicWalletDesc,
                laneCryptoWallet: c.paymentLaneCryptoWallet,
                laneCryptoWalletDesc: c.paymentLaneCryptoWalletDesc,
                laneCard: c.paymentLaneCard,
                laneCardDesc: c.paymentLaneCardDesc,
                laneCheapest: c.paymentLaneCheapest,
                backToLanes: c.paymentLaneBack,
                feesOnBuyer: c.paymentFeesOnBuyer,
                electronicWalletMenuTitle: c.paymentLaneElectronicWalletMenu,
                cryptoWalletMenuTitle: c.paymentLaneCryptoWalletMenu,
                cardMenuTitle: c.paymentLaneCardMenu,
                cardCheapestHint: c.paymentLaneCardCheapestHint,
                unavailable: c.paymentUnavailable,
                ripioEwalletTitle: c.ripioEwalletTitle
              }}
              formatLocalAmount={(option) =>
                option.totalLocal != null
                  ? formatDepositLocal(option.totalLocal, option.displayCurrency, intlLocale)
                  : formatUsd2(option.totalUsd, currencyLocale)
              }
              renderOption={renderDepositOption}
            />
          ) : null}

          {showPaymentMethods && paymentMethodsExpanded && paymentQuoteExpired && !paymentGatewayTabActive ? (
            <p className="pb-[2mm] text-xs text-terminal-warning">{c.quoteExpired}</p>
          ) : null}

          {showPaymentMethods && paymentMethodsExpanded && !paymentGatewayTabActive ? (
            <div className="md:hidden">
              <button
                type="button"
                disabled={confirmDisabled}
                onClick={() => void handleConfirm()}
                className="min-h-12 w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmLabel}
              </button>
              {quoteExpiresAt && quoteSecondsLeft > 0 ? (
                <p className="mt-1 text-right text-xs font-medium text-terminal-primary">
                  {formatMessage(c.quoteExpiresIn, { seconds: String(quoteSecondsLeft) })}
                </p>
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

          {status === 'pending_privy' && pendingReference ? (
            <PrivyOnRampFundPanel
              metadata={
                ((deposit?.metadata as Record<string, unknown> | undefined)?.provider as
                  | Record<string, unknown>
                  | undefined) ??
                ((checkout?.paymentIntents?.[0]?.metadata as Record<string, unknown> | undefined)?.gateway as
                  | Record<string, unknown>
                  | undefined)
              }
              amountUsd={totalUsd}
              stablecoinNetwork={stablecoinNetwork}
              vaultDeposits={usesPrivyVaultDeposit ? privyVaultDeposits : undefined}
              onFunded={async (txHash) => {
                if (mode === 'deposit' && deposit?.id) {
                  await fetch('/api/wallet/deposit-intents/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ depositId: deposit.id, txHash })
                  });
                  setStatus('done');
                  return;
                }
                if (batchId) {
                  await fetch('/api/marketplace/cart/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ batchId, txHash })
                  });
                  setStatus(usesPrivyVaultDeposit ? 'done' : 'share_pending');
                }
              }}
              onError={(message) => setError(message)}
            />
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
                href={depositReturnTo}
                className="inline-flex min-h-11 items-center rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
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
                  href={mode === 'deposit' ? depositReturnTo : '/dashboard/portfolio'}
                  className="inline-flex min-h-11 items-center rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
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
                className="min-h-11 rounded-lg bg-terminal-primary px-3 py-2 text-sm font-semibold text-white"
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
          status !== 'mercadopago_embedded' &&
          !paymentGatewayTabActive ? (
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

      {status !== 'done' && status !== 'share_pending' && status !== 'share_failed' && !paymentGatewayTabActive ? (
        <StickyActionBar
          summary={
            <div className="flex items-center justify-between text-sm">
              <span className="text-terminal-muted">{mode === 'deposit' ? c.depositTitle : c.purchaseTitle}</span>
              <span className="font-mono font-semibold text-terminal-primary">
                {mode === 'deposit' ? (
                  <>
                    USDC
                    <span className="ml-1.5">
                      {(showPaymentMethods ? displayTotalUsd : totalUsd).toLocaleString(currencyLocale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </>
                ) : (
                  formatUsd(totalUsd)
                )}
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
