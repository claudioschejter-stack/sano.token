'use client';

import { Copy, Wallet, CheckCircle2, QrCode, Loader2 } from 'lucide-react';
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
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || 'https://mainnet.base.org';

type Phase = 'loading' | 'needs_funds' | 'ready' | 'settling' | 'done';
type PayPath = 'sanova' | 'external';

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
  cartItems?: SimplifiedCheckoutCartItem[];
  onFunded?: () => void;
  ensureReference?: EnsureCheckoutReference;
};

/**
 * Manual crypto checkout (no auto-pay):
 * - Enough USDC in Sanova embedded wallet → show Pagar; settle only on tap
 * - Not enough → show address/QR + connect wallet to fund the embedded wallet
 * - Optional: pay directly from an external wallet (Coinbase / WalletConnect)
 */
export function CryptoWalletPanel({
  cryptoWallet,
  amountUsd,
  mode = 'deposit',
  cartItems = [],
  onFunded,
  ensureReference
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
  const [phase, setPhase] = useState<Phase>('loading');
  const [payPath, setPayPath] = useState<PayPath>('sanova');
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleErrorCode, setSettleErrorCode] = useState<string | null>(null);
  const [forceLegacySignerGrant, setForceLegacySignerGrant] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalPaying, setExternalPaying] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [fundingSending, setFundingSending] = useState(false);
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
  const cartItemsRef = useRef(cartItems);
  cartItemsRef.current = cartItems;
  const ensureReferenceRef = useRef(ensureReference);
  ensureReferenceRef.current = ensureReference;
  const mountedRef = useRef(true);

  const amountUsdc = requiredUsdc > 0 ? requiredUsdc : amountUsd;
  const hasEnoughSanova =
    balanceUsdc != null && Number.isFinite(balanceUsdc) && balanceUsdc + 1e-9 >= amountUsdc;
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
      if (code === 'PRIVY_SERVER_AUTO_SETTLE_NOT_CONFIGURED' || code === 'NOT_CONFIGURED') {
        return sc.cryptoWalletAutoSettleNotConfigured;
      }
      if (code === 'NO_PENDING_PURCHASE' || code === 'CART_EMPTY' || code === 'CART_CHECKOUT_FAILED') {
        return sc.cryptoWalletNoPendingPurchase;
      }
      if (isPrivyAuthorizationSignerError(errorCode) || code === 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED') {
        return sc.cryptoWalletPrivySignerRequired;
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
        errorCode.toLowerCase().includes('transaction already closed') ||
        errorCode.toLowerCase().includes('expired transaction') ||
        errorCode.toLowerCase().includes('interactive transaction timeout')
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
      return sc.cryptoWalletAutoSettleError.replace('{error}', errorCode);
    },
    [
      sc.cryptoWalletAllowlistRequired,
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
      sc.cryptoWalletPrivySignerRequired
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

    type SettlePayload = {
      ok?: boolean;
      status?: string;
      error?: string;
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
    ) => ({
      ok: Boolean(parsed.ok && parsed.data.ok !== false),
      status: parsed.data.status,
      error: parsed.errorCode ?? parsed.data.error,
      amountUsd: parsed.data.amountUsd,
      balanceUsdc: parsed.data.balanceUsdc,
      batchId: parsed.data.batchId,
      txHash: parsed.data.txHash
    });

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
          await addSigners({
            address: receiveAddress,
            signers: [{ signerId: PRIVY_AUTH_QUORUM_ID, policyIds: [] }]
          }).catch(() => undefined);
        },
        ensureBatchId: async (preferred) =>
          preferred ??
          (await createPendingCart(items, false)) ??
          (await createPendingCart(items, true)),
        settleWithClientPrivy
      });

      if (!mountedRef.current) return;

      if (typeof outcome.amountUsd === 'number' && outcome.amountUsd > 0) {
        setRequiredUsdc(outcome.amountUsd);
        requiredRef.current = outcome.amountUsd;
      }
      if (typeof outcome.balanceUsdc === 'number') {
        applyKnownBalance(outcome.balanceUsdc);
      }

      if (outcome.kind === 'settled') {
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
      setSettleError(mapSettleError(outcome.errorCode));
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
          // Prefer the cart total from props; only override if watch reports a live pending amount.
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
                          amount: amountUsdc.toFixed(2)
                        })}
                  </button>
                  {settleError ? (
                    <p className="text-[11px] leading-relaxed text-red-500">{settleError}</p>
                  ) : null}
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
                  ) : receiveAddress ? (
                    <button
                      type="button"
                      onClick={() => setForceLegacySignerGrant(true)}
                      className="w-full rounded-lg border border-amber-500/40 bg-amber-900/10 px-3 py-2.5 text-[11px] font-semibold text-amber-400"
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
                                  amount: (fundShortfallUsdc > 0 ? fundShortfallUsdc : amountUsdc).toFixed(
                                    2
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
                          amount: amountUsdc.toFixed(2)
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
