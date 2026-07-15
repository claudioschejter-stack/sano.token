'use client';

import { ExternalLink, CheckCircle2, X, Loader2, CreditCard, Wallet } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { useFiatOnramp } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { usePrivyEmbeddedWallet } from '../../hooks/usePrivyEmbeddedWallet';
import { usePrivyWalletLink } from '../../hooks/usePrivyWalletLink';
import { usePrivyVaultDeposit } from '../../hooks/usePrivyVaultDeposit';
import { useExternalWalletVaultDeposit } from '../../hooks/useExternalWalletVaultDeposit';
import { useFundWallet } from '@privy-io/react-auth';
import {
  PRIVY_FIAT_ONRAMP_BASE_CHAIN,
  resolvePrivyFiatOnRampSource
} from '../../lib/payments/privyOnRampPolicy';
import { CoinbaseConnectButton } from '../wallet/CoinbaseConnectButton';
import { WalletConnectConnectButton } from '../wallet/WalletConnectConnectButton';
import type { PrivyEarnVaultRow } from './PrivyEarnVaultsPanel';

type DepositStep =
  | 'input'
  | 'funding'
  | 'depositing'
  | 'done'
  | 'error';

type PaymentTab = 'card' | 'crypto';

type Props = {
  vault: PrivyEarnVaultRow;
  onClose: () => void;
};

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function PrivyEarnVaultDepositPanel({ vault, onClose }: Props) {
  const [amount, setAmount] = useState('100');
  const [tab, setTab] = useState<PaymentTab>('card');
  const [step, setStep] = useState<DepositStep>('input');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { fund } = useFiatOnramp();
  const { fundWallet } = useFundWallet();
  const { enabled, ready, authenticated, address, ensureReady } = usePrivyEmbeddedWallet();
  const { linkPrivyWallet, linking } = usePrivyWalletLink();
  const { depositToVaults } = usePrivyVaultDeposit();
  const { address: externalWalletAddress, isConnected: isExternalWalletConnected } = useAccount();
  const { depositToVaultExternal } = useExternalWalletVaultDeposit();

  const amountUsd = Number.parseFloat(amount) || 0;
  const fiatSource = resolvePrivyFiatOnRampSource('US');

  const runCardDeposit = useCallback(async () => {
    if (!enabled || !ready) {
      setErrorMsg('Privy no está configurado. Contactá a soporte.');
      return;
    }
    if (amountUsd <= 0) {
      setErrorMsg('Ingresá un monto válido mayor a 0.');
      return;
    }

    setStep('funding');
    setErrorMsg(null);

    try {
      let walletAddress = address;
      if (!authenticated || !walletAddress) {
        const linked = await linkPrivyWallet();
        walletAddress = linked ?? walletAddress;
      }
      if (!walletAddress) {
        walletAddress = await ensureReady();
        await linkPrivyWallet();
      }
      if (!walletAddress) {
        throw new Error('PRIVY_WALLET_REQUIRED');
      }

      // First: try useFundWallet (newer, supports card directly)
      let fundedViaFundWallet = false;
      try {
        await fundWallet({
          address: walletAddress,
          options: {
            amount: amountUsd.toFixed(2),
            chain: base,
            asset: 'USDC',
            defaultFundingMethod: 'card',
            card: { preferredProvider: 'moonpay' }
          }
        });
        fundedViaFundWallet = true;
      } catch (fw) {
        const msg = fw instanceof Error ? fw.message : '';
        if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('closed')) {
          setStep('input');
          return;
        }
      }

      // Fallback: useFiatOnramp
      if (!fundedViaFundWallet) {
        const fundResult = await fund({
          source: {
            assets: fiatSource.assets as Parameters<typeof fund>[0]['source']['assets'],
            defaultAsset: fiatSource.defaultAsset as Parameters<typeof fund>[0]['source']['defaultAsset']
          },
          destination: {
            asset: 'usdc',
            chain: PRIVY_FIAT_ONRAMP_BASE_CHAIN,
            address: walletAddress
          },
          defaultAmount: amountUsd.toFixed(2),
          environment: 'production'
        });

        if (fundResult.status !== 'submitted' && fundResult.status !== 'confirmed') {
          throw new Error('PRIVY_FUND_INCOMPLETE');
        }
      }

      // Second: deposit USDC from embedded wallet → vault via Privy Earn API
      if (vault.vaultAddress) {
        setStep('depositing');
        await depositToVaults({
          stablecoinNetwork: 'BASE',
          deposits: [{ vaultAddress: vault.vaultAddress, amountUsd }]
        });
      }

      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DEPOSIT_FAILED';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('closed')) {
        setErrorMsg(msg);
        setStep('error');
      } else {
        setStep('input');
      }
    }
  }, [
    address,
    amountUsd,
    authenticated,
    depositToVaults,
    enabled,
    ensureReady,
    fiatSource.assets,
    fiatSource.defaultAsset,
    fund,
    fundWallet,
    linkPrivyWallet,
    ready,
    vault.vaultAddress
  ]);

  const runWalletDeposit = useCallback(async () => {
    if (amountUsd <= 0) {
      setErrorMsg('Ingresá un monto válido mayor a 0.');
      setStep('error');
      return;
    }
    if (!vault.vaultAddress) {
      setErrorMsg('Dirección de bóveda no disponible.');
      setStep('error');
      return;
    }

    setErrorMsg(null);
    setStep('depositing');

    try {
      await depositToVaultExternal({
        stablecoinNetwork: 'BASE',
        deposits: [{ vaultAddress: vault.vaultAddress, amountUsd }]
      });
      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DEPOSIT_FAILED';
      if (!msg.toLowerCase().includes('reject') && !msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('denied')) {
        setErrorMsg(msg);
        setStep('error');
      } else {
        setStep('input');
      }
    }
  }, [amountUsd, depositToVaultExternal, vault.vaultAddress]);

  const busy = step === 'funding' || step === 'depositing';

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-terminal-primary/30 bg-terminal-bg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-terminal-text">Depositar en {vault.name}</p>
          <p className="text-xs text-terminal-muted">
            APY actual: <span className="font-semibold text-terminal-success">{formatPercent(vault.userApyPercent)}</span>
            {' · '}{vault.assetSymbol || 'USDC'} en Base
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-terminal-muted hover:text-terminal-text"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {step === 'done' ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 size={32} className="text-terminal-success" />
            <div>
              <p className="font-semibold text-terminal-success">¡Depósito completado!</p>
              <p className="mt-1 text-xs text-terminal-muted">
                Tu USDC fue depositado en <span className="font-medium">{vault.name}</span>.
                Los tokens ERC-4626 fueron acreditados en tu wallet.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {/* Amount */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
                Monto a depositar (USDC)
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-card px-3 py-2">
                <span className="text-sm font-semibold text-terminal-muted">USDC</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="100"
                  disabled={busy}
                  className="flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-terminal-text outline-none focus:ring-0"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg border border-terminal-border bg-terminal-card p-1">
              <button
                type="button"
                onClick={() => setTab('card')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                  tab === 'card'
                    ? 'bg-terminal-primary text-white'
                    : 'text-terminal-muted hover:text-terminal-text'
                }`}
              >
                <CreditCard size={14} />
                Tarjeta / Privy
              </button>
              <button
                type="button"
                onClick={() => setTab('crypto')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                  tab === 'crypto'
                    ? 'bg-terminal-primary text-white'
                    : 'text-terminal-muted hover:text-terminal-text'
                }`}
              >
                <Wallet size={14} />
                Wallet externa
              </button>
            </div>

            {/* Card payment tab */}
            {tab === 'card' ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-terminal-border bg-terminal-card p-3">
                  <p className="text-xs font-semibold text-terminal-text">¿Cómo funciona?</p>
                  <ol className="mt-2 space-y-1 text-xs text-terminal-muted list-decimal list-inside">
                    <li>Comprás USDC con tarjeta vía Privy (Stripe / MoonPay / Coinbase Pay)</li>
                    <li>El USDC se acredita en tu wallet embebida en Base</li>
                    <li>Privy deposita automáticamente en <span className="font-medium">{vault.name}</span></li>
                    <li>Recibís tokens ERC-4626 que representan tu posición en la bóveda</li>
                  </ol>
                </div>

                {errorMsg && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="button"
                  disabled={busy || linking || !ready || amountUsd <= 0}
                  onClick={() => void runCardDeposit()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  {step === 'funding'
                    ? 'Comprando USDC con Privy…'
                    : step === 'depositing'
                      ? `Depositando en ${vault.name}…`
                      : `Depositar ${amountUsd > 0 ? `${amountUsd.toFixed(2)} USDC` : ''} con tarjeta`}
                </button>

                {!ready && enabled && (
                  <p className="text-center text-[10px] text-terminal-warning">
                    Iniciá sesión para activar el pago con tarjeta.
                  </p>
                )}
              </div>
            ) : null}

            {/* External wallet / on-chain tab */}
            {tab === 'crypto' ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-terminal-border bg-terminal-card p-3">
                  <p className="text-xs font-semibold text-terminal-text">¿Cómo funciona?</p>
                  <ol className="mt-2 space-y-1 text-xs text-terminal-muted list-decimal list-inside">
                    <li>Conectá tu wallet (Coinbase Wallet o WalletConnect)</li>
                    <li>
                      Tu wallet firma el <span className="font-mono">approve</span> +{' '}
                      <span className="font-mono">deposit</span> en el contrato de {vault.name}
                    </li>
                    <li>Recibís los tokens ERC-4626 directo en tu propia wallet</li>
                  </ol>
                </div>

                {!isExternalWalletConnected ? (
                  <div className="space-y-2">
                    <CoinbaseConnectButton showAccount={false} />
                    <div className="text-center text-[10px] text-terminal-muted">o</div>
                    <WalletConnectConnectButton />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-terminal-border bg-terminal-card px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">
                        Wallet conectada
                      </p>
                      <p className="mt-0.5 break-all font-mono text-xs text-terminal-text">
                        {externalWalletAddress}
                      </p>
                    </div>

                    {errorMsg && (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {errorMsg}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={busy || amountUsd <= 0}
                      onClick={() => void runWalletDeposit()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                      {step === 'depositing'
                        ? `Depositando en ${vault.name}…`
                        : `Depositar ${amountUsd > 0 ? `${amountUsd.toFixed(2)} USDC` : ''} con mi wallet`}
                    </button>
                  </div>
                )}

                {vault.vaultAddress ? (
                  <a
                    href={`https://basescan.org/address/${vault.vaultAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-[11px] text-terminal-primary hover:underline"
                  >
                    Ver contrato de la bóveda en BaseScan
                    <ExternalLink size={12} />
                  </a>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
