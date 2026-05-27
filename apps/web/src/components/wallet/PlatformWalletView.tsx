'use client';

import Link from 'next/link';
import { ArrowUpRight, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WalletConnectButton } from '../marketplace/WalletConnectButton';
import { useInjectedWallet } from '../../hooks/useInjectedWallet';

type WalletSummary = {
  account: { balance: string; reserved: string; available: string; currency: string; status: string };
  ledger: Array<{ id: string; type: string; amount: string; balanceAfter: string; createdAt: string }>;
  deposits: Array<{ id: string; status: string; amountUsd: string; method: string; stablecoinNetwork: string | null; payToAddress: string | null; txHash: string | null }>;
  withdrawals: Array<{ id: string; status: string; amountUsd: string; method: string; stablecoinNetwork: string | null; destinationAddress: string | null; providerCheckoutUrl: string | null; txHash: string | null }>;
};

type DepositResponse = {
  id: string;
  status: string;
  amountUsd: string;
  method: string;
  stablecoinNetwork: string | null;
  payToAddress: string | null;
  providerCheckoutUrl: string | null;
  metadata: unknown;
};

type WithdrawalResponse = {
  id: string;
  status: string;
  amountUsd: string;
  method: string;
  providerCheckoutUrl: string | null;
};

const LEDGER_LABELS: Record<string, string> = {
  DEPOSIT_CREDIT: 'Depósito acreditado',
  TOKEN_PURCHASE_DEBIT: 'Compra de tokens',
  WITHDRAWAL_DEBIT: 'Retiro',
  REFUND_CREDIT: 'Reembolso',
  MANUAL_ADJUSTMENT: 'Ajuste manual'
};

export function PlatformWalletView() {
  const { address } = useInjectedWallet();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [amountUsd, setAmountUsd] = useState('100');
  const [method, setMethod] = useState('AUTO_CHEAPEST');
  const [network, setNetwork] = useState('BASE');
  const [country, setCountry] = useState('AR');
  const [userHasStablecoin, setUserHasStablecoin] = useState(true);
  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteQuote | null>(null);
  const [txHash, setTxHash] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('50');
  const [withdrawMethod, setWithdrawMethod] = useState<'STABLECOIN' | 'FIAT'>('STABLECOIN');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState('BASE');
  const [withdrawal, setWithdrawal] = useState<WithdrawalResponse | null>(null);

  const loadWallet = async () => {
    const response = await fetch('/api/wallet');
    const data = (await response.json()) as { wallet?: WalletSummary };
    setWallet(data.wallet ?? null);
  };

  useEffect(() => {
    void loadWallet();
  }, []);

  useEffect(() => {
    if (address && !withdrawAddress) {
      setWithdrawAddress(address);
    }
  }, [address, withdrawAddress]);

  const createDeposit = async () => {
    setStatus('creating');
    setError(null);
    const response = await fetch('/api/wallet/deposit-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountUsd: Number(amountUsd),
        method: method === 'AUTO_CHEAPEST' ? undefined : method,
        auto: method === 'AUTO_CHEAPEST',
        country,
        userHasStablecoin,
        stablecoinNetwork: network,
        walletAddress: address
      })
    });
    const data = (await response.json()) as { error?: string; deposit?: DepositResponse; selectedRoute?: RouteQuote };
    if (!response.ok || !data.deposit) {
      setError(data.error ?? 'DEPOSIT_CREATE_FAILED');
      setStatus('idle');
      return;
    }
    setDeposit(data.deposit);
    setSelectedRoute(data.selectedRoute ?? null);
    if (data.deposit.providerCheckoutUrl) {
      window.location.href = data.deposit.providerCheckoutUrl;
      return;
    }
    setStatus('waiting_tx');
  };

  const verifyDeposit = async () => {
    if (!deposit || !txHash.trim()) return;
    setStatus('verifying');
    setError(null);
    const response = await fetch('/api/wallet/deposit-intents/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depositId: deposit.id, txHash: txHash.trim(), walletAddress: address })
    });
    const data = (await response.json()) as { error?: string; deposit?: DepositResponse };
    if (!response.ok || !data.deposit) {
      setError(data.error ?? 'DEPOSIT_VERIFY_FAILED');
      setStatus('waiting_tx');
      return;
    }
    setDeposit(data.deposit);
    setStatus('confirmed');
    await loadWallet();
  };

  const createWithdrawal = async () => {
    setStatus('withdrawing');
    setError(null);
    const response = await fetch('/api/wallet/withdraw-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountUsd: Number(withdrawAmount),
        method: withdrawMethod,
        destinationAddress: withdrawMethod === 'STABLECOIN' ? withdrawAddress : undefined,
        stablecoinNetwork: withdrawNetwork
      })
    });
    const data = (await response.json()) as { error?: string; withdrawal?: WithdrawalResponse };
    if (!response.ok || !data.withdrawal) {
      setError(data.error ?? 'WITHDRAWAL_FAILED');
      setStatus('idle');
      return;
    }
    setWithdrawal(data.withdrawal);
    if (data.withdrawal.providerCheckoutUrl) {
      window.location.href = data.withdrawal.providerCheckoutUrl;
      return;
    }
    setStatus('withdrawal_pending');
    await loadWallet();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">Wallet Sanova</p>
          <h1 className="mt-2 text-3xl font-bold text-terminal-text">Mi cartera</h1>
          <p className="mt-2 max-w-2xl text-terminal-muted">
            Depositá fiat o stablecoins, retirá a tu wallet o banco, y usá el saldo para comprar tokens RWA en el marketplace.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary transition hover:bg-terminal-primary/20"
        >
          <ShoppingBag size={16} />
          Comprar tokens
          <ArrowUpRight size={14} />
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-terminal-border bg-terminal-card p-6 md:col-span-2">
          <p className="text-sm text-terminal-muted">Saldo disponible</p>
          <p className="mt-2 font-mono text-4xl font-bold text-terminal-primary">
            {wallet ? `${wallet.account.available} ${wallet.account.currency}` : '...'}
          </p>
          <p className="mt-1 text-xs text-terminal-muted">
            Total: {wallet?.account.balance ?? '0'} · Reservado: {wallet?.account.reserved ?? '0'} USD
          </p>
        </div>
        <div className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <p className="text-sm text-terminal-muted">Estado</p>
          <p className="mt-2 text-lg font-semibold text-terminal-text">{wallet?.account.status ?? 'ACTIVE'}</p>
          <p className="mt-2 text-xs text-terminal-muted">KYC requerido para depositar, retirar y operar.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <h2 className="text-lg font-semibold text-terminal-text">Depositar fondos</h2>
          <p className="mt-1 text-sm text-terminal-muted">El sistema elige automáticamente la ruta más barata.</p>
          <div className="mt-4 space-y-3">
            <WalletConnectButton />
            <input
              value={amountUsd}
              onChange={(event) => setAmountUsd(event.target.value)}
              className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
              placeholder="Monto USD"
            />
            <select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text">
              <option value="AUTO_CHEAPEST">Automático: opción más barata</option>
              <option value="USDC_ONCHAIN">Stablecoin on-chain</option>
              <option value="TRANSAK">Transak (fiat → crypto)</option>
              <option value="BRIDGE">Bridge</option>
              <option value="STRIPE">Stripe</option>
              <option value="MERCADO_PAGO">Mercado Pago</option>
              <option value="COINBASE">Coinbase</option>
            </select>
            <select value={country} onChange={(event) => setCountry(event.target.value)} className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text">
              <option value="AR">Argentina</option>
              <option value="MX">México (SPEI/Nu)</option>
              <option value="BR">Brasil (Pix)</option>
              <option value="US">USA (ACH)</option>
              <option value="EU">Europa (SEPA)</option>
              <option value="IN">India (UPI)</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-terminal-muted">
              <input type="checkbox" checked={userHasStablecoin} onChange={(event) => setUserHasStablecoin(event.target.checked)} />
              Ya tengo stablecoins
            </label>
            {method === 'USDC_ONCHAIN' || method === 'AUTO_CHEAPEST' ? (
              <select value={network} onChange={(event) => setNetwork(event.target.value)} className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text">
                <option value="BASE">Base (USDC)</option>
                <option value="POLYGON">Polygon (USDC)</option>
                <option value="SOLANA">Solana (USDC)</option>
                <option value="TRON">TRON (USDT)</option>
              </select>
            ) : null}
            <button onClick={() => void createDeposit()} className="w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white">
              Crear depósito
            </button>
            {selectedRoute ? (
              <div className="rounded-lg border border-terminal-success/30 bg-terminal-success/10 p-3 text-xs text-terminal-success">
                Ruta: {selectedRoute.label} · fee ~USD {selectedRoute.estimatedFeeUsd.toFixed(2)}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <h2 className="text-lg font-semibold text-terminal-text">Retirar fondos</h2>
          <p className="mt-1 text-sm text-terminal-muted">Stablecoin a tu wallet o retiro fiat (revisión manual).</p>
          <div className="mt-4 space-y-3">
            <input
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text"
              placeholder="Monto USD"
            />
            <select value={withdrawMethod} onChange={(event) => setWithdrawMethod(event.target.value as 'STABLECOIN' | 'FIAT')} className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text">
              <option value="STABLECOIN">Stablecoin a mi wallet</option>
              <option value="FIAT">Fiat (revisión manual / Transak)</option>
            </select>
            {withdrawMethod === 'STABLECOIN' ? (
              <>
                <select value={withdrawNetwork} onChange={(event) => setWithdrawNetwork(event.target.value)} className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text">
                  <option value="BASE">Base</option>
                  <option value="POLYGON">Polygon</option>
                  <option value="SOLANA">Solana</option>
                  <option value="TRON">TRON</option>
                </select>
                <input
                  value={withdrawAddress}
                  onChange={(event) => setWithdrawAddress(event.target.value)}
                  className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-sm text-terminal-text"
                  placeholder="Dirección destino"
                />
              </>
            ) : (
              <p className="rounded-lg border border-terminal-border bg-terminal-bg p-3 text-xs text-terminal-muted">
                El equipo de tesorería procesará tu retiro bancario en 1–3 días hábiles.
              </p>
            )}
            <button onClick={() => void createWithdrawal()} className="w-full rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-3 text-sm font-semibold text-terminal-primary">
              Solicitar retiro
            </button>
            {withdrawal ? (
              <p className="text-xs text-terminal-success">Retiro {withdrawal.id.slice(0, 8)} · {withdrawal.status}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
        <h2 className="text-lg font-semibold text-terminal-text">Verificar depósito on-chain</h2>
        {deposit?.payToAddress ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-terminal-muted">Enviar a treasury:</p>
            <p className="break-all rounded-lg border border-terminal-border bg-terminal-bg p-3 font-mono text-terminal-text">{deposit.payToAddress}</p>
            <input value={txHash} onChange={(event) => setTxHash(event.target.value)} className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text" placeholder="Tx hash" />
            <button onClick={() => void verifyDeposit()} className="rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white">
              Verificar y acreditar
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-terminal-muted">Creá un depósito on-chain para ver instrucciones.</p>
        )}
        {error ? <p className="mt-3 text-sm text-terminal-warning">{error}</p> : null}
        <p className="mt-3 text-xs text-terminal-muted">Estado: {status}</p>
      </section>

      <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
        <h2 className="text-lg font-semibold text-terminal-text">Movimientos recientes</h2>
        <div className="mt-4 space-y-2">
          {wallet?.ledger.length ? wallet.ledger.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm">
              <div>
                <p className="text-terminal-text">{LEDGER_LABELS[entry.type] ?? entry.type}</p>
                <p className="text-xs text-terminal-muted">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              <span className={`font-mono ${Number(entry.amount) >= 0 ? 'text-terminal-success' : 'text-terminal-warning'}`}>
                {entry.amount} USD
              </span>
            </div>
          )) : (
            <p className="text-sm text-terminal-muted">Sin movimientos todavía.</p>
          )}
        </div>
      </section>

      {wallet?.withdrawals.length ? (
        <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <h2 className="text-lg font-semibold text-terminal-text">Retiros recientes</h2>
          <div className="mt-4 space-y-2">
            {wallet.withdrawals.map((item) => (
              <div key={item.id} className="flex justify-between rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm">
                <span className="text-terminal-muted">{item.method} · {item.status}</span>
                <span className="font-mono text-terminal-text">{item.amountUsd} USD</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

type RouteQuote = {
  method: string;
  provider: string;
  label: string;
  estimatedFeeUsd: number;
  estimatedFeeBps: number;
  stablecoinNetwork?: string;
  reason: string;
};
