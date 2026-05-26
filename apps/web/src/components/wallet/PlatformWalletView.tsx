'use client';

import { useEffect, useState } from 'react';
import { WalletConnectButton } from '../marketplace/WalletConnectButton';
import { useInjectedWallet } from '../../hooks/useInjectedWallet';

type WalletSummary = {
  account: { balance: string; reserved: string; available: string; currency: string; status: string };
  ledger: Array<{ id: string; type: string; amount: string; balanceAfter: string; createdAt: string }>;
  deposits: Array<{ id: string; status: string; amountUsd: string; method: string; stablecoinNetwork: string | null; payToAddress: string | null; txHash: string | null }>;
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

export function PlatformWalletView() {
  const { address } = useInjectedWallet();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [amountUsd, setAmountUsd] = useState('100');
  const [method, setMethod] = useState('AUTO_CHEAPEST');
  const [network, setNetwork] = useState('BASE');
  const [country, setCountry] = useState('US');
  const [userHasStablecoin, setUserHasStablecoin] = useState(true);
  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteQuote | null>(null);
  const [txHash, setTxHash] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState<string | null>(null);

  const loadWallet = async () => {
    const response = await fetch('/api/wallet');
    const data = (await response.json()) as { wallet?: WalletSummary };
    setWallet(data.wallet ?? null);
  };

  useEffect(() => {
    void loadWallet();
  }, []);

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-terminal-primary">Wallet Sanova</p>
        <h1 className="mt-2 text-3xl font-bold text-terminal-text">Saldo interno</h1>
        <p className="mt-2 text-terminal-muted">
          Depositá fiat o stablecoins y usá el saldo para comprar tokens. Los fondos quedan respaldados por treasury/multisig.
        </p>
      </header>

      <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
        <p className="text-sm text-terminal-muted">Saldo disponible</p>
        <p className="mt-2 font-mono text-4xl font-bold text-terminal-primary">
          {wallet ? `${wallet.account.available} ${wallet.account.currency}` : '...'}
        </p>
        <p className="mt-1 text-xs text-terminal-muted">Reservado: {wallet?.account.reserved ?? '0'} USD</p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <h2 className="text-lg font-semibold text-terminal-text">Depositar fondos</h2>
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
              <option value="LOCAL_RAIL">Rail local barato</option>
              <option value="BRIDGE">Bridge fiat/stablecoin</option>
              <option value="TRANSAK">Transak</option>
              <option value="RAMP">Ramp Network</option>
              <option value="STRIPE">Stripe</option>
              <option value="MERCADO_PAGO">Mercado Pago</option>
              <option value="COINBASE">Coinbase</option>
            </select>
            <select value={country} onChange={(event) => setCountry(event.target.value)} className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text">
              <option value="US">USA (ACH)</option>
              <option value="MX">Mexico (SPEI/Nu)</option>
              <option value="BR">Brasil (Pix/Nu)</option>
              <option value="IN">India (UPI)</option>
              <option value="EU">Europa (SEPA)</option>
              <option value="AR">Argentina</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-terminal-muted">
              <input
                type="checkbox"
                checked={userHasStablecoin}
                onChange={(event) => setUserHasStablecoin(event.target.checked)}
              />
              Ya tengo stablecoins y quiero pagar lo más barato posible
            </label>
            {method === 'USDC_ONCHAIN' || method === 'AUTO_CHEAPEST' ? (
              <select value={network} onChange={(event) => setNetwork(event.target.value)} className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-terminal-text">
                <option value="BASE">Base</option>
                <option value="POLYGON">Polygon</option>
                <option value="SOLANA">Solana</option>
                <option value="TRON">TRON</option>
              </select>
            ) : null}
            <button onClick={() => void createDeposit()} className="w-full rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white">
              Crear depósito
            </button>
            {selectedRoute ? (
              <div className="rounded-lg border border-terminal-success/30 bg-terminal-success/10 p-3 text-xs text-terminal-success">
                Ruta elegida: {selectedRoute.label} · costo estimado USD {selectedRoute.estimatedFeeUsd.toFixed(2)} · {selectedRoute.reason}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-terminal-border bg-terminal-card p-6">
          <h2 className="text-lg font-semibold text-terminal-text">Verificar depósito</h2>
          {deposit?.payToAddress ? (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-terminal-muted">Enviar a treasury:</p>
              <p className="break-all rounded-lg border border-terminal-border bg-terminal-bg p-3 font-mono text-terminal-text">{deposit.payToAddress}</p>
              <input value={txHash} onChange={(event) => setTxHash(event.target.value)} className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-terminal-text" placeholder="Tx hash" />
              <button onClick={() => void verifyDeposit()} className="rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white">Verificar y acreditar</button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-terminal-muted">Creá un depósito para ver instrucciones.</p>
          )}
          {error ? <p className="mt-3 text-sm text-terminal-warning">{error}</p> : null}
          <p className="mt-3 text-xs text-terminal-muted">Estado: {status}</p>
        </div>
      </section>

      <section className="rounded-xl border border-terminal-border bg-terminal-card p-6">
        <h2 className="text-lg font-semibold text-terminal-text">Últimos movimientos</h2>
        <div className="mt-4 space-y-2">
          {wallet?.ledger.map((entry) => (
            <div key={entry.id} className="flex justify-between rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm">
              <span className="text-terminal-muted">{entry.type}</span>
              <span className="font-mono text-terminal-text">{entry.amount} USD</span>
            </div>
          ))}
        </div>
      </section>
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
