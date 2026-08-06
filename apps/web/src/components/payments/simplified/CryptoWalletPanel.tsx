'use client';

import { Copy, Wallet, CheckCircle2, QrCode, Loader2, Timer } from 'lucide-react';
import { waitForTransactionReceipt, writeContract } from '@wagmi/core';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { erc20Abi, parseUnits } from 'viem';
import { useAccount, useConfig, useSwitchChain } from 'wagmi';
import { formatMessage } from '../../../i18n';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useSigners } from '@privy-io/react-auth';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { usePrivyEmbeddedWallet } from '../../../hooks/usePrivyEmbeddedWallet';
import { usePrivyTreasuryPayment } from '../../../hooks/usePrivyTreasuryPayment';
import { usePrivyVaultDeposit } from '../../../hooks/usePrivyVaultDeposit';
import { useUsdcTreasuryPayment } from '../../../hooks/useUsdcTreasuryPayment';
import { readJsonResponse } from '../../../lib/http/readJsonResponse';
import { resolveDisplayReceiveAddress } from '../../../lib/investor/canonicalReceiveAddress';
import type { SimplifiedCryptoWalletMethod } from '../../../lib/payments/checkoutBestRouteService';
import {
  isPrivyAuthorizationSignerError,
  runCryptoWalletSettle
} from '../../../lib/payments/cryptoWalletSettleOrchestrator';
import {
  BASE_USDC_TOKEN_ADDRESS,
  buildCryptoReceiveQrPayload,
  cryptoReceiveQrImageUrl,
  type CryptoReceiveQrMode
} from '../../../lib/payments/cryptoReceiveQr';
import {
  summarizeCartSettlement,
  type CartSettlementSummary
} from '../../../lib/payments/cartSettlementConfirmation';
import { formatUsdPrecise, roundUsdc } from '../../../lib/payments/formatUsdPrecise';
import { normalizeCartLineItems } from '../../../lib/payments/normalizeCartLineItems';
import { runSanovaPayFlow } from '../../../lib/payments/runSanovaPayFlow';
import type { VaultDepositLine } from '../../../lib/web3/vaultDepositPayment';
import { CoinbaseConnectButton } from '../../wallet/CoinbaseConnectButton';
import { WalletConnectConnectButton } from '../../wallet/WalletConnectConnectButton';
import { LegacyFundedWalletSignerGrant } from './LegacyFundedWalletSignerGrant';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';
import type { EnsureCheckoutReference, SimplifiedCheckoutCartItem } from './SimplifiedCheckout';

const PRIVY_AUTH_QUORUM_ID = process.env.NEXT_PUBLIC_PRIVY_AUTHORIZATION_KEY_QUORUM_ID?.trim() ?? '';

const QR_SIZE = 220;
const USDC_BASE = BASE_USDC_TOKEN_ADDRESS;
const BASESCAN_TX = 'https://basescan.org/tx/';
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
/** Live User-pays gas quote validity window while the crypto panel is open. */
const GAS_QUOTE_TTL_SEC = 30;

type Phase = 'loading' | 'needs_funds' | 'ready' | 'settling' | 'done';
type PayPath = 'sanova' | 'external';

function formatUsdcAmount(value: number): string {
  return formatUsdPrecise(value);
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
  cartItems?: SimplifiedCheckoutCartItem[];
  onFunded?: () => void;
  ensureReference?: EnsureCheckoutReference;
  /** Bubble live payable (investment + gas) up to the payment menu header. */
  onPayableChange?: (info: { totalUsd: number; networkFeeUsd: number; investmentUsd: number }) => void;
};

/**
 * Manual crypto checkout (no auto-pay):
 * - Enough USDC in Sanova embedded wallet → show Pagar; settle only on tap
 * - Not enough → show address/QR + connect wallet to fund the embedded wallet
 * - Optional: pay directly from an external wallet (Coinbase / WalletConnect)
 */
export function CryptoWalletPanel({
  cryptoWallet,
  country,
  amountUsd,
  mode = 'deposit',
  cartItems = [],
  onFunded,
  ensureReference,
  onPayableChange
}: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { isDesktop } = useDeviceDetection();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const { address: externalAddress, isConnected: isExternalConnected } = useAccount();
  const { payToTreasury } = useUsdcTreasuryPayment();
  const { payToTreasury: payToTreasuryPrivy } = usePrivyTreasuryPayment();
  const { depositToVaults: depositToVaultsPrivy } = usePrivyVaultDeposit();
  const { ensureReady: ensurePrivyReady } = usePrivyEmbeddedWallet();
  const { addSigners } = useSigners();

  const [copiedAddr, setCopiedAddr] = useState(false);
  const [showQr, setShowQr] = useState(false);
  /** Bare address QR by default — Ripio/Lemon reject EIP-681 USDC transfer URIs. */
  const [qrMode, setQrMode] = useState<CryptoReceiveQrMode>('address');
  const [phase, setPhase] = useState<Phase>('loading');
  const [payPath, setPayPath] = useState<PayPath>('sanova');
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleErrorCode, setSettleErrorCode] = useState<string | null>(null);
  const [forceLegacySignerGrant, setForceLegacySignerGrant] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalPaying, setExternalPaying] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [fundingSending, setFundingSending] = useState(false);
  const investmentUsdc = Number.isFinite(amountUsd) ? amountUsd : 0;
  const routeNetworkFeeUsdc = Math.max(0, Number((cryptoWallet.networkFeeUsd ?? 0).toFixed(6)));
  const routePayableUsdc = Math.max(
    Number((cryptoWallet.totalUsd ?? 0).toFixed(6)),
    Number((investmentUsdc + routeNetworkFeeUsdc).toFixed(6)),
    investmentUsdc
  );

  const [balanceUsdc, setBalanceUsdc] = useState<number | null>(null);
  /** Settle-time payable override (investment + exact gas). Never store investment-only. */
  const [settlePayableUsdc, setSettlePayableUsdc] = useState<number | null>(null);
  const [localNetworkFeeUsdc, setLocalNetworkFeeUsdc] = useState(0);
  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState(GAS_QUOTE_TTL_SEC);
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const [serverAddress, setServerAddress] = useState<string | null>(null);

  const onFundedRef = useRef(onFunded);
  onFundedRef.current = onFunded;
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  const balanceRef = useRef<number | null>(null);
  const cartItemsRef = useRef(cartItems);
  cartItemsRef.current = cartItems;
  const ensureReferenceRef = useRef(ensureReference);
  ensureReferenceRef.current = ensureReference;
  const mountedRef = useRef(true);
  /** Last Privy failure reason from the server, appended to the UI message. */
  const lastSettleDetailRef = useRef<string | null>(null);
  /** Settled batch used to confirm USDC → treasury and RWA → investor wallet. */
  const [settledBatchId, setSettledBatchId] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<CartSettlementSummary | null>(null);

  const networkFeeUsdc = Math.max(routeNetworkFeeUsdc, localNetworkFeeUsdc);
  // Always investment + gas for purchase; deposit mode stays at loaded amount.
  const amountUsdc =
    mode === 'purchase'
      ? Math.max(
          settlePayableUsdc ?? 0,
          routePayableUsdc,
          roundUsdc(investmentUsdc + networkFeeUsdc)
        )
      : settlePayableUsdc && settlePayableUsdc > 0
        ? settlePayableUsdc
        : investmentUsdc;
  /** Gas actually included in the payable — keep hero / breakdown / header in sync. */
  const includedGasUsdc =
    mode === 'purchase' ? Math.max(0, roundUsdc(amountUsdc - investmentUsdc)) : networkFeeUsdc;
  const requiredRef = useRef(amountUsdc);
  requiredRef.current = amountUsdc;
  const onPayableChangeRef = useRef(onPayableChange);
  onPayableChangeRef.current = onPayableChange;
  const hasEnoughSanova =
    balanceUsdc != null && Number.isFinite(balanceUsdc) && balanceUsdc + 1e-9 >= amountUsdc;

  const quoteTtlSec = Math.max(
    10,
    Number(cryptoWallet.networkFeeQuoteTtlSec) || GAS_QUOTE_TTL_SEC
  );

  // Countdown + requote when the 30s window expires.
  useEffect(() => {
    if (mode !== 'purchase' || investmentUsdc <= 0) return;
    let cancelled = false;
    let tickId: number | null = null;
    let refreshing = false;

    const refresh = async () => {
      if (refreshing || cancelled) return;
      refreshing = true;
      setQuoteRefreshing(true);
      try {
        const res = await fetch('/api/payments/checkout-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountUsd: investmentUsdc,
            country: country || 'US',
            referenceId: `gas-${Date.now()}`,
            payerAddress: serverAddress
          })
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          cryptoWallet?: { networkFeeUsd?: number; totalUsd?: number };
        };
        const fee = Number(data.cryptoWallet?.networkFeeUsd ?? 0);
        if (Number.isFinite(fee) && fee > 0 && !cancelled) {
          setLocalNetworkFeeUsdc(fee);
        }
      } catch {
        // keep previous quote
      } finally {
        refreshing = false;
        if (!cancelled) {
          setQuoteRefreshing(false);
          setQuoteSecondsLeft(quoteTtlSec);
        }
      }
    };

    setQuoteSecondsLeft(quoteTtlSec);
    void refresh();
    tickId = window.setInterval(() => {
      setQuoteSecondsLeft((prev) => {
        if (prev <= 1) {
          void refresh();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      if (tickId != null) window.clearInterval(tickId);
    };
  }, [mode, investmentUsdc, country, serverAddress, quoteTtlSec]);

  useEffect(() => {
    if (mode !== 'purchase') return;
    onPayableChangeRef.current?.({
      investmentUsd: investmentUsdc,
      networkFeeUsd: includedGasUsdc,
      totalUsd: amountUsdc
    });
  }, [mode, investmentUsdc, includedGasUsdc, amountUsdc]);

  // Poll until both legs are verified: USDC at treasury and RWA in the wallet.
  useEffect(() => {
    if (phase !== 'done' || !settledBatchId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/marketplace/cart/status?batchId=${encodeURIComponent(settledBatchId)}&sync=1`,
          { credentials: 'same-origin', cache: 'no-store' }
        );
        const parsed = await readJsonResponse<{
          status?: {
            paymentIntents?: Array<{
              status?: string;
              txHash?: string | null;
              tokenCount?: number;
              metadata?: Record<string, unknown> | null;
            }>;
          };
        }>(res);
        const intents = parsed.data.status?.paymentIntents ?? [];
        if (cancelled || !intents.length) return;
        const summary = summarizeCartSettlement(intents);
        setSettlement(summary);
        if (summary.tokensDelivered || summary.deliveryFailed) {
          cancelled = true;
        }
      } catch {
        // keep polling; success card waits for confirmation
      }
    };

    void poll();
    const id = window.setInterval(() => {
      if (cancelled || attempts >= 12) {
        window.clearInterval(id);
        return;
      }
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [phase, settledBatchId]);

  const fundShortfallUsdc = Math.max(
    0,
    Math.round((amountUsdc - (balanceUsdc ?? 0)) * 1e6) / 1e6
  );
  const receiveAddress = normalizeAddress(
    resolveDisplayReceiveAddress({
      serverLinkedAddress: serverAddress,
      privyClientAddress: null
    })
  );

  const mapSettleError = useCallback(
    (errorCode: string) => {
      const code = errorCode.trim().toUpperCase();
      const lower = errorCode.toLowerCase();
      if (code === 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED' || code === 'NOT_CONFIGURED') {
        return sc.cryptoWalletAutoSettleNotConfigured;
      }
      if (code === 'NO_PENDING_PURCHASE' || code === 'CART_EMPTY' || code === 'CART_CHECKOUT_FAILED') {
        return sc.cryptoWalletNoPendingPurchase;
      }
      if (isPrivyAuthorizationSignerError(errorCode) || code === 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED') {
        return sc.cryptoWalletPrivySignerRequired;
      }
      // Legacy RPC User-pays path (pre Transfer API). Surface a clear retry, not raw JSON.
      if (
        lower.includes('invalid request body for rpc resolution') ||
        (lower.includes('privy_send_transaction_failed') &&
          (lower.includes('invalid_data') || lower.includes(':400:')))
      ) {
        return sc.cryptoWalletRpcUserPaysUnsupported;
      }
      if (code === 'PRIVY_TRANSFER_FAILED' || lower.startsWith('privy_transfer_failed')) {
        return sc.cryptoWalletTransferFailed.replace('{error}', errorCode);
      }
      if (
        code === 'PRIVY_SESSION_REQUIRED' ||
        code === 'PRIVY_WALLET_NOT_READY' ||
        code === 'PRIVY_NOT_READY' ||
        code === 'PRIVY_PROVIDER_UNAVAILABLE'
      ) {
        return sc.cryptoWalletPrivySessionRetry;
      }
      if (code === 'PRIVY_WALLET_ADDRESS_MISMATCH') {
        return sc.cryptoWalletPrivyAddressMismatch;
      }
      if (
        code === 'CART_CHECKOUT_TIMEOUT' ||
        lower.includes('transaction already closed') ||
        lower.includes('expired transaction') ||
        lower.includes('interactive transaction timeout')
      ) {
        return sc.cryptoWalletCheckoutTimeout;
      }
      if (
        code === 'PAY_ENDPOINT_NOT_FOUND' ||
        code === 'INVALID_JSON_RESPONSE' ||
        (code.startsWith('HTTP_') && code.endsWith('_HTML_RESPONSE')) ||
        errorCode.includes('Unexpected token')
      ) {
        return sc.cryptoWalletHtmlGatewayError;
      }
      if (code === 'CART_MANUAL_REVIEW_REQUIRED') {
        return sc.cryptoWalletManualReview;
      }
      if (
        code === 'USDC_BALANCE_READ_FAILED' ||
        code === 'RPC_BALANCE_READ_FAILED' ||
        code === 'PRIVY_WALLET_ID_NOT_FOUND'
      ) {
        return sc.cryptoWalletAutoSettleBalanceReadFailed;
      }
      if (
        code === 'INVESTOR_WALLET_REQUIRED' ||
        code === 'WALLET_REQUIRED' ||
        code === 'WALLET_REQUIRED_FOR_TOKENIZED_PURCHASE'
      ) {
        return sc.cryptoWalletLinkRequired;
      }
      if (code === 'ALLOWLIST_NOT_APPROVED' || code === 'ONCHAIN_ALLOWLIST_NOT_APPROVED') {
        return sc.cryptoWalletAllowlistRequired;
      }
      if (code === 'VAULT_RECIPIENT_NOT_ALLOWED') {
        return sc.cryptoWalletVaultRecipientPending;
      }
      return sc.cryptoWalletAutoSettleError.replace('{error}', errorCode);
    },
    [
      sc.cryptoWalletAllowlistRequired,
      sc.cryptoWalletVaultRecipientPending,
      sc.cryptoWalletAutoSettleBalanceReadFailed,
      sc.cryptoWalletAutoSettleError,
      sc.cryptoWalletAutoSettleNotConfigured,
      sc.cryptoWalletCheckoutTimeout,
      sc.cryptoWalletHtmlGatewayError,
      sc.cryptoWalletLinkRequired,
      sc.cryptoWalletManualReview,
      sc.cryptoWalletNoPendingPurchase,
      sc.cryptoWalletPrivyAddressMismatch,
      sc.cryptoWalletPrivySessionRetry,
      sc.cryptoWalletPrivySignerRequired,
      sc.cryptoWalletRpcUserPaysUnsupported,
      sc.cryptoWalletTransferFailed
    ]
  );

  const applyKnownBalance = useCallback((next: number) => {
    if (!Number.isFinite(next)) return;
    balanceRef.current = next;
    setBalanceUsdc(next);
    if (phaseRef.current === 'done' || phaseRef.current === 'settling') return;

    const need = requiredRef.current;
    if (next + 1e-9 >= need) {
      setPhase('ready');
      setPayPath((current) => (current === 'external' ? current : 'sanova'));
    } else {
      setPhase('needs_funds');
    }
  }, []);

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

  /** Manual only — never called automatically on balance ready. */
  const runSettle = useCallback(async () => {
    if (mode !== 'purchase') return;
    if (phaseRef.current === 'done' || phaseRef.current === 'settling') return;
    if (balanceRef.current == null || balanceRef.current + 1e-9 < requiredRef.current) {
      setSettleErrorCode(null);
      setSettleError(sc.cryptoWalletInsufficientPrivy);
      setPhase('needs_funds');
      return;
    }

    // Read from refs so a stale useCallback never ships an empty cart.
    const items = normalizeCartLineItems(cartItemsRef.current);
    if (!items.length) {
      setSettleErrorCode(null);
      setSettleError(sc.cryptoWalletNoPendingPurchase);
      setPhase('ready');
      return;
    }

    setPhase('settling');
    setSettleError(null);
    setSettleErrorCode(null);
    lastSettleDetailRef.current = null;

    const withSettleDetail = (message: string) => {
      const detail = lastSettleDetailRef.current?.trim();
      return detail ? `${message} (${detail})` : message;
    };

    type SettlePayload = {
      ok?: boolean;
      status?: string;
      error?: string;
      /** Privy reason kept verbatim so failures stay debuggable in checkout. */
      detail?: string;
      amountUsd?: number;
      balanceUsdc?: number | null;
      batchId?: string;
      txHash?: string;
      checkout?: { batchId?: string };
    };

    const createPendingCart = async (
      cartLines: typeof items,
      forceRefresh = false
    ): Promise<string | null> => {
      const ensure = ensureReferenceRef.current;
      if (ensure) {
        // Reuse an open cart when possible — forceRefresh caused duplicate "Compra" ghosts.
        const ref = await ensure('USDC_ONCHAIN', undefined, { forceRefresh }).catch(() => null);
        if (ref?.referenceId) return ref.referenceId;
      }

      const checkoutRes = await fetch('/api/marketplace/cart/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: cartLines,
          method: 'USDC_ONCHAIN',
          stablecoinNetwork: 'BASE'
        })
      });
      const checkoutParsed = await readJsonResponse<SettlePayload>(checkoutRes);
      if (checkoutParsed.ok && checkoutParsed.data.checkout?.batchId) {
        return checkoutParsed.data.checkout.batchId;
      }
      const createError =
        checkoutParsed.errorCode ??
        checkoutParsed.data.error ??
        (checkoutParsed.ok ? null : 'CART_CHECKOUT_FAILED');
      if (createError) {
        throw new Error(createError);
      }
      return null;
    };

    const payHeadersFor = (lineCount: number) =>
      ({
        'content-type': 'application/json',
        'x-sanova-cart-lines': String(lineCount)
      }) as const;

    const toFlowResult = (
      parsed: Awaited<ReturnType<typeof readJsonResponse<SettlePayload>>>
    ) => {
      const detail = parsed.data.detail?.trim();
      if (detail) {
        lastSettleDetailRef.current = detail;
      }
      return {
        ok: Boolean(parsed.ok && parsed.data.ok !== false),
        status: parsed.data.status,
        error: parsed.errorCode ?? parsed.data.error,
        amountUsd: parsed.data.amountUsd,
        balanceUsdc: parsed.data.balanceUsdc,
        batchId: parsed.data.batchId,
        txHash: parsed.data.txHash
      };
    };

    /** When server auth-key settle is blocked, sign from the embedded Privy session instead. */
    const settleWithClientPrivy = async (batchId: string, payAmountUsd: number): Promise<void> => {
      if (receiveAddress && PRIVY_AUTH_QUORUM_ID) {
        await addSigners({
          address: receiveAddress,
          signers: [{ signerId: PRIVY_AUTH_QUORUM_ID, policyIds: [] }]
        }).catch(() => undefined);
      }

      const statusRes = await fetch(
        `/api/marketplace/cart/status?batchId=${encodeURIComponent(batchId)}`,
        { credentials: 'same-origin', cache: 'no-store' }
      );
      const statusParsed = await readJsonResponse<{
        status?: {
          paymentIntents?: Array<{
            amountUsd: string;
            metadata?: Record<string, unknown> | null;
          }>;
        };
      }>(statusRes);

      const intents = statusParsed.data.status?.paymentIntents ?? [];
      const vaultDeposits: VaultDepositLine[] = intents.flatMap((row) => {
        const meta = row.metadata ?? {};
        if (meta.purchaseMode !== 'ERC4626_DEPOSIT' || typeof meta.vaultAddress !== 'string') {
          return [];
        }
        const lineAmount = Number.parseFloat(row.amountUsd);
        if (!Number.isFinite(lineAmount) || lineAmount <= 0) return [];
        return [{ vaultAddress: meta.vaultAddress, amountUsd: lineAmount }];
      });

      const txHash =
        vaultDeposits.length > 0
          ? await depositToVaultsPrivy({ stablecoinNetwork: 'BASE', deposits: vaultDeposits })
          : await payToTreasuryPrivy({ amountUsd: payAmountUsd, stablecoinNetwork: 'BASE' });

      const confirmRes = await fetch('/api/marketplace/cart/confirm', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          batchId,
          txHash,
          walletAddress: receiveAddress
        })
      });
      const confirmParsed = await readJsonResponse<{ error?: string }>(confirmRes);
      if (!confirmParsed.ok) {
        throw new Error(confirmParsed.errorCode ?? confirmParsed.data.error ?? 'STABLECOIN_VERIFY_FAILED');
      }
    };

    try {
      // Ensure Custom Auth identity + signed wallet exist before settle.
      await fetch('/api/investor/wallet/provision', {
        method: 'POST',
        credentials: 'same-origin'
      }).catch(() => undefined);

      const sufficientSanova =
        balanceRef.current != null && balanceRef.current + 1e-9 >= requiredRef.current;

      const outcome = await runCryptoWalletSettle({
        expectedWalletAddress: receiveAddress,
        hasSufficientSanovaBalance: sufficientSanova,
        runServerPay: async () =>
          runSanovaPayFlow({
            items,
            clientBalanceUsdc: balanceRef.current,
            createPendingCart: (cartLines) => createPendingCart(cartLines, false),
            postPaySanova: async (cartLines, clientBalanceUsdc) => {
              const res = await fetch('/api/marketplace/cart/pay-sanova', {
                method: 'POST',
                credentials: 'same-origin',
                headers: payHeadersFor(cartLines.length),
                body: JSON.stringify({ items: cartLines, clientBalanceUsdc })
              });
              return toFlowResult(await readJsonResponse<SettlePayload>(res));
            },
            postLegacySettle: async (cartLines, clientBalanceUsdc) => {
              const res = await fetch('/api/wallet/privy-inbound/settle', {
                method: 'POST',
                credentials: 'same-origin',
                headers: payHeadersFor(cartLines.length),
                body: JSON.stringify({ items: cartLines, clientBalanceUsdc })
              });
              return toFlowResult(await readJsonResponse<SettlePayload>(res));
            }
          }),
        waitForPrivySession: async () => {
          // Warm Custom Auth JWT so Privy can hydrate without an email modal.
          await fetch('/api/auth/privy-token', {
            credentials: 'same-origin',
            cache: 'no-store'
          }).catch(() => undefined);
          const address = await ensurePrivyReady();
          return { address };
        },
        grantServerSigner: async () => {
          if (!receiveAddress || !PRIVY_AUTH_QUORUM_ID) return;
          try {
            await addSigners({
              address: receiveAddress,
              signers: [{ signerId: PRIVY_AUTH_QUORUM_ID, policyIds: [] }]
            });
          } catch {
            // Already granted (PATCH 400) or session cannot mutate — server retry still runs.
          }
        },
        ensureBatchId: async (preferred) =>
          preferred ??
          (await createPendingCart(items, false)) ??
          (await createPendingCart(items, true)),
        settleWithClientPrivy
      });

      if (!mountedRef.current) return;

      if (typeof outcome.amountUsd === 'number' && outcome.amountUsd > 0) {
        // Server waiting_funds / settle quotes return payable (= investment + gas).
        setSettlePayableUsdc((prev) =>
          prev != null && prev + 1e-9 >= outcome.amountUsd! ? prev : outcome.amountUsd!
        );
      }
      if (typeof outcome.balanceUsdc === 'number') {
        applyKnownBalance(outcome.balanceUsdc);
      }

      if (outcome.kind === 'settled') {
        setSettledBatchId(outcome.batchId ?? null);
        setPhase('done');
        onFundedRef.current?.();
        return;
      }

      if (outcome.kind === 'waiting_funds') {
        setPhase('needs_funds');
        setSettleErrorCode(null);
        setSettleError(sc.cryptoWalletInsufficientPrivy);
        return;
      }

      setSettleErrorCode(outcome.errorCode);
      setSettleError(withSettleDetail(mapSettleError(outcome.errorCode)));
      if (outcome.switchToExternal) {
        setPayPath('external');
      }
      setPhase(
        balanceRef.current != null && balanceRef.current + 1e-9 >= requiredRef.current
          ? 'ready'
          : 'needs_funds'
      );
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof Error ? error.message : 'FAILED';
      setSettleErrorCode(message.trim().toUpperCase());
      setSettleError(mapSettleError(message));
      setPhase('ready');
    }
  }, [
    addSigners,
    applyKnownBalance,
    depositToVaultsPrivy,
    ensurePrivyReady,
    mapSettleError,
    mode,
    payToTreasuryPrivy,
    receiveAddress,
    sc.cryptoWalletInsufficientPrivy,
    sc.cryptoWalletNoPendingPurchase
  ]);

  /** Top up the Sanova embedded wallet from a connected external wallet (not treasury pay). */
  const fundSanovaFromExternal = useCallback(async () => {
    if (!receiveAddress) {
      setFundingError(sc.cryptoWalletPrivyUnavailable);
      return;
    }
    if (!isExternalConnected || !externalAddress) {
      setFundingError(sc.cryptoWalletExternalConnectFirst);
      return;
    }
    if (fundingSending || phaseRef.current === 'done' || phaseRef.current === 'settling') return;

    const sendAmount = fundShortfallUsdc > 0 ? fundShortfallUsdc : amountUsdc;
    if (sendAmount <= 0) return;

    setFundingSending(true);
    setFundingError(null);

    try {
      try {
        await switchChainAsync({ chainId: 8453 });
      } catch {
        /* wallet may already be on Base */
      }

      const hash = (await writeContract(config, {
        chainId: 8453,
        address: USDC_BASE as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [receiveAddress as `0x${string}`, parseUnits(sendAmount.toFixed(6), 6)]
      } as unknown as Parameters<typeof writeContract>[1])) as `0x${string}`;

      await waitForTransactionReceipt(config, { hash });

      if (!mountedRef.current) return;
      const bal = await readClientBalance(receiveAddress);
      if (bal != null) applyKnownBalance(bal);
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof Error ? error.message : 'FUND_FAILED';
      if (
        message.toLowerCase().includes('reject') ||
        message.toLowerCase().includes('denied') ||
        message.toLowerCase().includes('cancel')
      ) {
        setFundingError(null);
      } else {
        setFundingError(sc.cryptoWalletFundSendError.replace('{error}', message));
      }
    } finally {
      if (mountedRef.current) setFundingSending(false);
    }
  }, [
    amountUsdc,
    applyKnownBalance,
    config,
    externalAddress,
    fundShortfallUsdc,
    fundingSending,
    isExternalConnected,
    readClientBalance,
    receiveAddress,
    sc.cryptoWalletExternalConnectFirst,
    sc.cryptoWalletFundSendError,
    sc.cryptoWalletPrivyUnavailable,
    switchChainAsync
  ]);

  const payWithExternalWallet = useCallback(async () => {
    if (mode !== 'purchase') return;
    if (!isExternalConnected || !externalAddress) {
      setExternalError(sc.cryptoWalletExternalConnectFirst);
      return;
    }
    if (externalPaying || phaseRef.current === 'done') return;

    setExternalPaying(true);
    setExternalError(null);

    try {
      const ref = ensureReference
        ? await ensureReference('USDC_ONCHAIN', undefined, {
            paymentOptionId: 'walletconnect_usdc',
            walletAddress: externalAddress
          })
        : null;
      if (!ref?.referenceId) {
        throw new Error('CHECKOUT_REFERENCE_FAILED');
      }

      const txHash = await payToTreasury({
        amountUsd: amountUsdc,
        stablecoinNetwork: 'BASE'
      });

      const confirmRes = await fetch('/api/marketplace/cart/confirm', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: ref.referenceId,
          txHash,
          walletAddress: externalAddress
        })
      });
      const confirmParsed = await readJsonResponse<{ error?: string }>(confirmRes);
      if (!confirmParsed.ok) {
        throw new Error(confirmParsed.errorCode ?? confirmParsed.data.error ?? 'STABLECOIN_VERIFY_FAILED');
      }

      if (!mountedRef.current) return;
      setPhase('done');
      onFundedRef.current?.();
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof Error ? error.message : 'EXTERNAL_PAY_FAILED';
      if (
        message.toLowerCase().includes('reject') ||
        message.toLowerCase().includes('denied') ||
        message.toLowerCase().includes('cancel')
      ) {
        setExternalError(null);
      } else if (message === 'WALLET_NOT_CONNECTED') {
        setExternalError(sc.cryptoWalletExternalConnectFirst);
      } else if (message === 'CHECKOUT_REFERENCE_FAILED') {
        setExternalError(sc.cryptoWalletExternalCheckoutFailed);
      } else {
        setExternalError(sc.cryptoWalletExternalPayError.replace('{error}', message));
      }
    } finally {
      if (mountedRef.current) setExternalPaying(false);
    }
  }, [
    amountUsdc,
    ensureReference,
    externalAddress,
    externalPaying,
    isExternalConnected,
    mode,
    payToTreasury,
    sc.cryptoWalletExternalCheckoutFailed,
    sc.cryptoWalletExternalConnectFirst,
    sc.cryptoWalletExternalPayError
  ]);

  // Mount: provision wallet + read balance. Do NOT create checkout / settle here.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await fetch('/api/investor/wallet/provision', {
          method: 'POST',
          credentials: 'same-origin'
        }).catch(() => undefined);

        const watchRes = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
        if (cancelled) return;

        let address: string | null = null;
        if (watchRes.ok) {
          const watchData = (await watchRes.json()) as {
            address?: string | null;
            balanceUsdc?: number | null;
            balanceKnown?: boolean;
            pendingPurchase?: { amountUsd?: number } | null;
          };
          address = normalizeAddress(watchData.address);
          // Do NOT overwrite payable with pendingPurchase.amountUsd — that value is
          // investment only and would strip live User-pays gas from the UI.
          if (address) setServerAddress(address);

          if (watchData.balanceKnown !== false && typeof watchData.balanceUsdc === 'number') {
            applyKnownBalance(watchData.balanceUsdc);
          } else if (address) {
            const bal = await readClientBalance(address);
            if (!cancelled && bal != null) applyKnownBalance(bal);
          }
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

  // Poll balance while waiting for funds / ready — never auto-pays.
  useEffect(() => {
    if (phase === 'done' || phase === 'settling') return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/wallet/privy-inbound/watch', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          address?: string | null;
          balanceUsdc?: number | null;
          balanceKnown?: boolean;
          newInbounds?: unknown[];
          pendingPurchase?: { amountUsd?: number } | null;
        };

        const watched = normalizeAddress(data.address);
        if (watched) setServerAddress(watched);

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
        }
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
  }, [applyKnownBalance, mode, phase, readClientBalance]);

  const qrPayload = receiveAddress
    ? buildCryptoReceiveQrPayload({
        receiveAddress,
        amountUsdc,
        mode: qrMode
      })
    : null;

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
    receiveAddress && qrPayload ? (
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
        {(isDesktop || showQr) && qrPayload ? (
          <div
            className={`${isDesktop ? '' : 'mt-3'} flex flex-col items-center gap-2 rounded-xl border border-terminal-border bg-terminal-card p-4`}
          >
            <div className="flex w-full gap-1 rounded-lg border border-terminal-border bg-terminal-bg p-1">
              <button
                type="button"
                onClick={() => setQrMode('address')}
                className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                  qrMode === 'address'
                    ? 'bg-terminal-primary text-white'
                    : 'text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {sc.cryptoWalletQrModeAddress}
              </button>
              <button
                type="button"
                onClick={() => setQrMode('eip681_usdc')}
                className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                  qrMode === 'eip681_usdc'
                    ? 'bg-terminal-primary text-white'
                    : 'text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {sc.cryptoWalletQrModeEip681}
              </button>
            </div>
            <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
              <img
                src={cryptoReceiveQrImageUrl(qrPayload, QR_SIZE)}
                alt={sc.cryptoWalletQrAlt.replace('{amount}', amountUsdc.toFixed(2))}
                width={QR_SIZE}
                height={QR_SIZE}
                className="block rounded"
              />
            </div>
            <p className="max-w-[260px] text-center text-[10px] leading-relaxed text-terminal-muted">
              {qrMode === 'address' ? sc.cryptoWalletQrAddressHint : sc.cryptoWalletQrEip681Hint}
            </p>
          </div>
        ) : null}
      </div>
    ) : null;

  const pathTabs =
    mode === 'purchase' ? (
      <div className="flex gap-1 rounded-lg border border-terminal-border bg-terminal-bg p-1">
        <button
          type="button"
          onClick={() => setPayPath('sanova')}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-[11px] font-semibold transition-colors ${
            payPath === 'sanova'
              ? 'bg-terminal-primary text-white'
              : 'text-terminal-muted hover:text-terminal-text'
          }`}
        >
          <Wallet size={14} />
          {sc.cryptoWalletSanovaTab}
        </button>
        <button
          type="button"
          onClick={() => setPayPath('external')}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-[11px] font-semibold transition-colors ${
            payPath === 'external'
              ? 'bg-terminal-primary text-white'
              : 'text-terminal-muted hover:text-terminal-text'
          }`}
        >
          <Wallet size={14} />
          {sc.cryptoWalletExternalTab}
        </button>
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
            USDC · Base · {formatUsdcAmount(amountUsdc)} USDC
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-terminal-muted">
          {mode === 'purchase' ? sc.cryptoWalletExactAmountLabel : sc.cryptoWalletReceiveAmountLabel}
        </p>
        <p className="mt-1 text-2xl font-bold text-terminal-primary">
          {formatUsdcAmount(amountUsdc)} <span className="text-base font-semibold">USDC</span>
        </p>
        {mode === 'purchase' && includedGasUsdc > 0 ? (
          <p className="mt-0.5 text-xs text-terminal-muted">
            {formatMessage(sc.cryptoWalletPayableIncludesGas, {
              investment: formatUsdcAmount(investmentUsdc),
              gas: formatUsdcAmount(includedGasUsdc)
            })}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-terminal-muted">{sc.cryptoWalletOnBaseNote}</p>
        )}
        {mode === 'purchase' ? (
          <p className="mt-2 inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-terminal-muted">
            {quoteRefreshing ? (
              <Loader2 size={12} className="animate-spin text-terminal-primary" />
            ) : (
              <Timer size={12} className="text-terminal-primary" />
            )}
            {quoteRefreshing
              ? sc.cryptoWalletGasQuoteRefreshing
              : formatMessage(sc.cryptoWalletGasQuoteCountdown, {
                  seconds: String(quoteSecondsLeft).padStart(2, '0')
                })}
          </p>
        ) : null}
      </div>

      {phase === 'done' && mode === 'purchase' ? (
        <div
          className={`space-y-3 rounded-xl border px-4 py-5 ${
            settlement?.tokensDelivered
              ? 'border-terminal-success/50 bg-terminal-success/10'
              : settlement?.deliveryFailed
                ? 'border-amber-500/40 bg-amber-900/10'
                : 'border-terminal-primary/40 bg-terminal-primary/10'
          }`}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            {settlement?.tokensDelivered ? (
              <CheckCircle2 size={32} className="text-terminal-success" />
            ) : (
              <Loader2 size={28} className="animate-spin text-terminal-primary" />
            )}
            <p
              className={`text-base font-bold uppercase tracking-wide ${
                settlement?.tokensDelivered ? 'text-terminal-success' : 'text-terminal-primary'
              }`}
            >
              {settlement?.tokensDelivered
                ? sc.cryptoWalletPurchaseSuccessTitle
                : settlement?.deliveryFailed
                  ? sc.cryptoWalletPurchaseDeliveryFailedTitle
                  : sc.cryptoWalletPurchaseSettlingTitle}
            </p>
            <p className="text-xs text-terminal-muted">
              {settlement?.tokensDelivered
                ? formatMessage(sc.cryptoWalletPurchaseSuccessBody, {
                    tokens: String(settlement.tokenCount),
                    amount: formatUsdcAmount(investmentUsdc)
                  })
                : settlement?.deliveryFailed
                  ? sc.cryptoWalletPurchaseDeliveryFailedBody
                  : sc.cryptoWalletPurchaseSettlingBody}
            </p>
          </div>

          <div className="space-y-1.5 rounded-lg border border-terminal-border bg-terminal-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-terminal-text">
                {settlement?.paid ? (
                  <CheckCircle2 size={13} className="text-terminal-success" />
                ) : (
                  <Loader2 size={13} className="animate-spin text-terminal-primary" />
                )}
                {sc.cryptoWalletSuccessStepTreasury}
              </span>
              {settlement?.treasuryTxHash ? (
                <a
                  href={`${BASESCAN_TX}${settlement.treasuryTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-terminal-primary underline-offset-2 hover:underline"
                >
                  {sc.cryptoWalletSuccessViewTx}
                </a>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-terminal-text">
                {settlement?.tokensDelivered ? (
                  <CheckCircle2 size={13} className="text-terminal-success" />
                ) : (
                  <Loader2 size={13} className="animate-spin text-terminal-primary" />
                )}
                {sc.cryptoWalletSuccessStepTokens}
              </span>
              {settlement?.shareTxHashes[0] ? (
                <a
                  href={`${BASESCAN_TX}${settlement.shareTxHashes[0]}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-terminal-primary underline-offset-2 hover:underline"
                >
                  {sc.cryptoWalletSuccessViewTx}
                </a>
              ) : null}
            </div>
          </div>

          {settlement?.tokensDelivered ? (
            <a
              href="/dashboard/portfolio"
              className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-terminal-success py-3 text-sm font-bold text-white shadow-lg"
            >
              <CheckCircle2 size={16} />
              {sc.cryptoWalletSuccessViewPortfolio}
            </a>
          ) : null}
        </div>
      ) : phase === 'done' ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-terminal-success/40 bg-terminal-success/10 px-4 py-6 text-center">
          <CheckCircle2 size={28} className="text-terminal-success" />
          <p className="text-sm font-bold text-terminal-success">
            {sc.cryptoWalletDepositReceivedTitle}
          </p>
          <p className="text-xs text-terminal-muted">{sc.cryptoWalletDepositReceivedBody}</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-terminal-primary/30 bg-terminal-bg/80 p-4">
          {pathTabs}

          {payPath === 'sanova' || mode === 'deposit' ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-xs">
                <span className="text-terminal-muted">{sc.cryptoWalletPrivyBalanceLabel}</span>
                <span
                  className={`font-semibold ${hasEnoughSanova ? 'text-terminal-success' : 'text-terminal-text'}`}
                >
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
              ) : hasEnoughSanova && mode === 'purchase' ? (
                <>
                  <p className="text-xs leading-relaxed text-terminal-text">{sc.cryptoWalletSanovaManualPayHint}</p>
                  <button
                    type="button"
                    onClick={() => void runSettle()}
                    disabled={phase === 'settling'}
                    className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                  >
                    {phase === 'settling' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Wallet size={16} />
                    )}
                    {phase === 'settling'
                      ? sc.cryptoWalletAutoSettling
                      : formatMessage(sc.cryptoWalletPayButtonAmount, {
                          amount: formatUsdcAmount(amountUsdc)
                        })}
                  </button>
                  {settleError ? (
                    <p className="text-[11px] leading-relaxed text-red-500">{settleError}</p>
                  ) : null}
                  {/* Legacy email-wallet grant only when the funded Sanova address
                      is not the Custom Auth session wallet — not as a permanent CTA. */}
                  {receiveAddress &&
                  (forceLegacySignerGrant ||
                    settleErrorCode === 'PRIVY_WALLET_ADDRESS_MISMATCH' ||
                    settleError === sc.cryptoWalletPrivyAddressMismatch) ? (
                    <LegacyFundedWalletSignerGrant
                      fundedAddress={receiveAddress}
                      onGranted={() => {
                        setSettleError(null);
                        setSettleErrorCode(null);
                        setForceLegacySignerGrant(false);
                        setPhase('ready');
                      }}
                    />
                  ) : settleErrorCode === 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED' ||
                    settleErrorCode === 'PRIVY_WALLET_ADDRESS_MISMATCH' ? (
                    <button
                      type="button"
                      onClick={() => setForceLegacySignerGrant(true)}
                      className="w-full text-center text-[11px] font-medium text-terminal-muted underline-offset-2 hover:text-terminal-text hover:underline"
                    >
                      {sc.cryptoWalletLegacySignerOpen}
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-terminal-text">
                    {sc.cryptoWalletFundEmbeddedHint}
                  </p>
                  {addressBlock}
                  {qrBlock}

                  {mode === 'purchase' ? (
                    <div className="space-y-2 rounded-xl border border-terminal-border bg-terminal-card p-3">
                      <p className="text-[11px] font-semibold text-terminal-text">
                        {sc.cryptoWalletFundFromWalletTitle}
                      </p>
                      <p className="text-[11px] leading-relaxed text-terminal-muted">
                        {sc.cryptoWalletFundFromWalletBody}
                      </p>
                      {!isExternalConnected ? (
                        <>
                          <CoinbaseConnectButton showAccount={false} />
                          <div className="text-center text-[10px] text-terminal-muted">
                            {sc.cryptoWalletExternalOr}
                          </div>
                          <WalletConnectConnectButton />
                        </>
                      ) : (
                        <>
                          <div className="rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
                              {sc.cryptoWalletExternalConnectedLabel}
                            </p>
                            <p className="mt-0.5 break-all font-mono text-xs text-terminal-text">
                              {externalAddress}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={fundingSending || (fundShortfallUsdc <= 0 && amountUsdc <= 0)}
                            onClick={() => void fundSanovaFromExternal()}
                            className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3 text-sm font-bold text-white disabled:opacity-60"
                          >
                            {fundingSending ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Wallet size={16} />
                            )}
                            {fundingSending
                              ? sc.cryptoWalletFundSending
                              : formatMessage(sc.cryptoWalletFundSendButton, {
                                  amount: formatUsdcAmount(
                                    fundShortfallUsdc > 0 ? fundShortfallUsdc : amountUsdc
                                  )
                                })}
                          </button>
                          <CoinbaseConnectButton showAccount />
                        </>
                      )}
                      {fundingError ? (
                        <p className="text-[11px] leading-relaxed text-red-500">{fundingError}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-3 py-2 text-[11px] text-terminal-muted">
                    <Loader2 size={12} className="animate-spin text-terminal-primary" />
                    {sc.cryptoWalletWaitingForFunds}
                  </div>

                  {mode === 'purchase' ? (
                    <button
                      type="button"
                      onClick={() => setPayPath('external')}
                      className="w-full rounded-lg border border-terminal-border bg-terminal-card px-3 py-2.5 text-xs font-semibold text-terminal-primary"
                    >
                      {sc.cryptoWalletSwitchToExternalPay}
                    </button>
                  ) : null}
                </>
              )}

              {/* Mismatch grant UI also lives under the funded Pagar branch above. */}
              {settleError &&
              !(hasEnoughSanova && mode === 'purchase') ? (
                <p className="text-[11px] leading-relaxed text-red-500">{settleError}</p>
              ) : null}
              {receiveAddress &&
              !(hasEnoughSanova && mode === 'purchase') &&
              (forceLegacySignerGrant ||
                settleErrorCode === 'PRIVY_WALLET_ADDRESS_MISMATCH' ||
                settleError === sc.cryptoWalletPrivyAddressMismatch) ? (
                <LegacyFundedWalletSignerGrant
                  fundedAddress={receiveAddress}
                  onGranted={() => {
                    setSettleError(null);
                    setSettleErrorCode(null);
                    setForceLegacySignerGrant(false);
                    setPhase('ready');
                  }}
                />
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-terminal-text">{sc.cryptoWalletExternalHint}</p>

              {!isExternalConnected ? (
                <div className="space-y-2">
                  <CoinbaseConnectButton showAccount={false} />
                  <div className="text-center text-[10px] text-terminal-muted">{sc.cryptoWalletExternalOr}</div>
                  <WalletConnectConnectButton />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-terminal-border bg-terminal-card px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
                      {sc.cryptoWalletExternalConnectedLabel}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-xs text-terminal-text">{externalAddress}</p>
                  </div>

                  <button
                    type="button"
                    disabled={externalPaying || amountUsdc <= 0}
                    onClick={() => void payWithExternalWallet()}
                    className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-terminal-primary py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                  >
                    {externalPaying ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                    {externalPaying
                      ? sc.cryptoWalletExternalPaying
                      : formatMessage(sc.cryptoWalletExternalPayButton, {
                          amount: formatUsdcAmount(amountUsdc)
                        })}
                  </button>

                  <CoinbaseConnectButton showAccount />
                </div>
              )}

              {externalError ? (
                <p className="text-[11px] leading-relaxed text-red-500">{externalError}</p>
              ) : null}
            </div>
          )}
        </div>
      )}

      <PaymentFeeBreakdown
        amountUsd={investmentUsdc}
        totalUsd={amountUsdc}
        feeBps={cryptoWallet.feeBps}
        providerLabel="Base USDC"
        networkFeeUsd={includedGasUsdc}
        networkFeeIncluded
        defaultOpen
        gatewayChargedBy="Base USDC"
        gasChargedBy={sc.feeBreakdown.chargedByUserPaysUsdc}
      />
    </section>
  );
}
