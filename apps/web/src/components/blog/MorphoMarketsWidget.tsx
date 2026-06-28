'use client';

import { useEffect, useState, useCallback } from 'react';

/* ─── Types ──────────────────────────────────────────────────── */

type Reward = { asset: { address: string; chain: { id: number } }; supplyApr: number; borrowApr: number };
type MarketState = {
  collateralAssetsUsd: number | null;
  borrowAssetsUsd: number | null;
  supplyAssetsUsd: number | null;
  liquidityAssetsUsd: number | null;
  fee: string | null;
  utilization: string | null;
  supplyApy: number | null;
  avgSupplyApy: number | null;
  avgNetSupplyApy: number | null;
  borrowApy: number | null;
  avgBorrowApy: number | null;
  avgNetBorrowApy: number | null;
  rewards: Reward[] | null;
};
type Market = {
  marketId: string;
  lltv: string;
  loanAsset: { address: string; symbol: string; decimals: number } | null;
  collateralAsset: { address: string; symbol: string; decimals: number } | null;
  state: MarketState | null;
  chain: { id: number; network: string } | null;
};
type MarketsResponse = { markets: Market[]; fetchedAt: string };

type AssetItem = {
  symbol: string;
  address: string;
  price: { usd: number; timestamp: number } | null;
  yield: { apr: number; lookback: number } | null;
  chain: { id: number; network: string } | null;
};
type AssetsResponse = { assets: AssetItem[]; fetchedAt: string };

type PositionState = {
  supplyShares?: string;
  supplyAssets?: string;
  supplyAssetsUsd?: number;
  borrowShares?: string;
  borrowAssets?: string;
  borrowAssetsUsd?: number;
  collateral?: string;
  collateralUsd?: number;
};
type PositionItem = {
  user: { address: string };
  state: PositionState | null;
  market?: { marketId: string; loanAsset: { symbol: string } | null; collateralAsset: { symbol: string } | null };
};
type PositionsData = {
  topSuppliers: { items: PositionItem[] };
  topBorrowers: { items: PositionItem[] };
};
type PositionsResponse = { positions: PositionsData; marketKey: string; fetchedAt: string };

type MarketPosition = {
  market: { marketId: string; loanAsset: { symbol: string } | null; collateralAsset: { symbol: string } | null };
  state: { borrowAssetsUsd: number; supplyAssetsUsd: number } | null;
};
type VaultPosition = {
  vault: { address: string; name: string };
  state?: { assets: string; assetsUsd: number; shares: string };
  assets?: string;
  assetsUsd?: number;
};
type TxItem = { txHash: string; timestamp: number; type: string };
type PortfolioUser = {
  address: string;
  marketPositions: MarketPosition[];
  vaultPositions: VaultPosition[];
  vaultV2Positions: VaultPosition[];
};
type PortfolioData = {
  userByAddress: PortfolioUser | null;
  vaultV1Transactions: { items: TxItem[] };
  marketTransactions: { items: TxItem[] };
  vaultV2transactions: { items: TxItem[] };
};
type PortfolioResponse = { portfolio: PortfolioData; address: string; fetchedAt: string };

/* ─── Helpers ────────────────────────────────────────────────── */

function usd(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}
function pct(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}
function lltv(v: string | null | undefined): string {
  if (!v) return '—';
  return `${(Number(v) / 1e18 * 100).toFixed(0)}%`;
}
function util(u: string | null | undefined): { label: string; color: string } {
  if (!u) return { label: '—', color: 'text-slate-400' };
  const p = Number(u) * 100;
  return {
    label: `${p.toFixed(1)}%`,
    color: p > 85 ? 'text-red-600' : p > 60 ? 'text-amber-600' : 'text-emerald-600',
  };
}
function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function ChainBadge({ network }: { network: string }) {
  const isBase = network?.toLowerCase().includes('base');
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold ml-1 ${isBase ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
      {isBase ? 'Base' : 'Eth'}
    </span>
  );
}

/* ─── Hook: generic fetcher ──────────────────────────────────── */

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [url]);

  return { data, loading, error, load };
}

/* ─── Tab types ──────────────────────────────────────────────── */

type Tab = 'markets' | 'assets' | 'positions' | 'portfolio';

/* ─── Sub-views ──────────────────────────────────────────────── */

function MarketsTab() {
  const { data, loading, error, load } = useFetch<MarketsResponse>('/api/morpho/markets');

  useEffect(() => { void load(); }, [load]);

  const markets = (data?.markets ?? []).filter((m) => m.loanAsset && m.collateralAsset && m.state);
  const totalSupply = markets.reduce((s, m) => s + (m.state?.supplyAssetsUsd ?? 0), 0);
  const totalBorrow = markets.reduce((s, m) => s + (m.state?.borrowAssetsUsd ?? 0), 0);
  const totalLiquidity = markets.reduce((s, m) => s + (m.state?.liquidityAssetsUsd ?? 0), 0);

  return (
    <div>
      {!loading && !error && markets.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Supply total', val: usd(totalSupply), c: 'text-blue-700' },
            { label: 'Borrow total', val: usd(totalBorrow), c: 'text-amber-700' },
            { label: 'Liquidez', val: usd(totalLiquidity), c: 'text-emerald-700' },
          ].map(({ label, val, c }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`mt-1 font-bold font-mono text-base ${c}`}>{val}</p>
            </div>
          ))}
        </div>
      )}
      <LoadState loading={loading} error={error} empty={!loading && !error && markets.length === 0} />
      {!loading && !error && markets.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Par</th>
                <th className="px-3 py-2.5 text-right">Supply</th>
                <th className="px-3 py-2.5 text-right">Borrow</th>
                <th className="px-3 py-2.5 text-right">Liquidez</th>
                <th className="px-3 py-2.5 text-right">APY Supply</th>
                <th className="px-3 py-2.5 text-right">APY Borrow</th>
                <th className="px-3 py-2.5 text-right">Util.</th>
                <th className="px-3 py-2.5 text-right">LLTV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {markets.map((m) => {
                const st = m.state!;
                const { label: utLabel, color: utColor } = util(st.utilization);
                const rewardApr = (st.rewards ?? []).reduce((s, r) => s + (r.supplyApr ?? 0), 0);
                const netSupplyApy = (st.avgNetSupplyApy ?? st.avgSupplyApy ?? st.supplyApy ?? 0) + rewardApr;
                return (
                  <tr key={m.marketId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700">{m.collateralAsset!.symbol}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-600">{m.loanAsset!.symbol}</span>
                        {m.chain && <ChainBadge network={m.chain.network} />}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{usd(st.supplyAssetsUsd)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{usd(st.borrowAssetsUsd)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700 font-semibold">{usd(st.liquidityAssetsUsd)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                      {pct(netSupplyApy > 0 ? netSupplyApy : st.avgNetSupplyApy ?? st.supplyApy)}
                      {rewardApr > 0 && <span className="ml-1 rounded bg-orange-100 px-1 text-[10px] text-orange-600">+reward</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-700">{pct(st.avgNetBorrowApy ?? st.borrowApy)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${utColor}`}>{utLabel}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{lltv(m.lltv)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data?.fetchedAt && <Timestamp ts={data.fetchedAt} />}
        </div>
      )}
    </div>
  );
}

function AssetsTab() {
  const { data, loading, error, load } = useFetch<AssetsResponse>('/api/morpho/assets');

  useEffect(() => { void load(); }, [load]);

  const assets = data?.assets ?? [];

  return (
    <div>
      <LoadState loading={loading} error={error} empty={!loading && !error && assets.length === 0} />
      {!loading && !error && assets.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Activo</th>
                <th className="px-4 py-2.5 text-right">Precio USD</th>
                <th className="px-4 py-2.5 text-right">Yield APR</th>
                <th className="px-4 py-2.5 text-right">Período</th>
                <th className="px-4 py-2.5 text-right">Red</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((a) => (
                <tr key={`${a.address}-${a.chain?.id}`} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">{a.symbol}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                    {a.price?.usd != null ? `$${a.price.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {a.yield?.apr != null ? pct(a.yield.apr) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {a.yield?.lookback != null ? `${a.yield.lookback}d` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.chain && <ChainBadge network={a.chain.network} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.fetchedAt && <Timestamp ts={data.fetchedAt} />}
        </div>
      )}
    </div>
  );
}

function PositionsTab() {
  const { data, loading, error, load } = useFetch<PositionsResponse>('/api/morpho/positions');

  useEffect(() => { void load(); }, [load]);

  const suppliers = data?.positions?.topSuppliers?.items ?? [];
  const borrowers = data?.positions?.topBorrowers?.items ?? [];

  return (
    <div className="space-y-6">
      <LoadState loading={loading} error={error} empty={!loading && !error && suppliers.length === 0 && borrowers.length === 0} />

      {!loading && !error && suppliers.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Top Suppliers</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Usuario</th>
                  <th className="px-4 py-2.5 text-right">Supply</th>
                  <th className="px-4 py-2.5 text-right">Borrow</th>
                  <th className="px-4 py-2.5 text-right">Colateral</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{shortAddr(p.user.address)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-semibold">{usd(p.state?.supplyAssetsUsd)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-amber-700">{usd(p.state?.borrowAssetsUsd)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{usd(p.state?.collateralUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && borrowers.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Top Borrowers</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Usuario</th>
                  <th className="px-4 py-2.5 text-right">Borrow</th>
                  <th className="px-4 py-2.5 text-right">Colateral (raw)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {borrowers.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{shortAddr(p.user.address)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-amber-700 font-semibold">{usd(p.state?.borrowAssetsUsd)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500 text-xs">{p.state?.collateral ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.fetchedAt && <Timestamp ts={data.fetchedAt} />}
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioTab() {
  const { data, loading, error, load } = useFetch<PortfolioResponse>('/api/morpho/portfolio');

  useEffect(() => { void load(); }, [load]);

  const user = data?.portfolio?.userByAddress;
  const allTxs = [
    ...(data?.portfolio?.marketTransactions?.items ?? []),
    ...(data?.portfolio?.vaultV1Transactions?.items ?? []),
    ...(data?.portfolio?.vaultV2transactions?.items ?? []),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  const totalSupply = (user?.marketPositions ?? []).reduce((s, p) => s + (p.state?.supplyAssetsUsd ?? 0), 0);
  const totalBorrow = (user?.marketPositions ?? []).reduce((s, p) => s + (p.state?.borrowAssetsUsd ?? 0), 0);
  const totalVault = [
    ...(user?.vaultPositions ?? []).map((v) => v.state?.assetsUsd ?? 0),
    ...(user?.vaultV2Positions ?? []).map((v) => v.assetsUsd ?? 0),
  ].reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-5">
      <LoadState loading={loading} error={error} empty={!loading && !error && !user} />

      {!loading && !error && user && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Supply en mercados', val: usd(totalSupply), c: 'text-blue-700' },
              { label: 'Deuda activa', val: usd(totalBorrow), c: 'text-amber-700' },
              { label: 'En vaults', val: usd(totalVault), c: 'text-emerald-700' },
            ].map(({ label, val, c }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`mt-1 font-bold font-mono text-base ${c}`}>{val}</p>
              </div>
            ))}
          </div>

          {/* Market positions */}
          {user.marketPositions.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Posiciones en mercados</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Mercado</th>
                      <th className="px-4 py-2.5 text-right">Supply</th>
                      <th className="px-4 py-2.5 text-right">Borrow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {user.marketPositions.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 text-slate-700">
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                            {p.market?.collateralAsset?.symbol ?? '—'}
                          </span>
                          {' / '}
                          <span className="text-slate-600">{p.market?.loanAsset?.symbol ?? '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-semibold">{usd(p.state?.supplyAssetsUsd)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-700">{usd(p.state?.borrowAssetsUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vault positions */}
          {(user.vaultPositions.length > 0 || user.vaultV2Positions.length > 0) && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Posiciones en vaults</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Vault</th>
                      <th className="px-4 py-2.5 text-right">Valor (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...user.vaultPositions, ...user.vaultV2Positions].map((v, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 text-slate-700">{v.vault.name || shortAddr(v.vault.address)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-semibold">
                          {usd(v.state?.assetsUsd ?? v.assetsUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transactions */}
          {allTxs.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Últimas transacciones</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">TX</th>
                      <th className="px-4 py-2.5 text-left">Tipo</th>
                      <th className="px-4 py-2.5 text-right">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allTxs.map((tx, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-mono text-xs text-blue-700">
                          <a href={`https://etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {shortAddr(tx.txHash)}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{tx.type}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{fmtTs(tx.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data?.fetchedAt && <Timestamp ts={data.fetchedAt} />}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Shared UI atoms ────────────────────────────────────────── */

function LoadState({ loading, error, empty }: { loading: boolean; error: string | null; empty: boolean }) {
  if (loading)
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        Cargando datos…
      </div>
    );
  if (error)
    return <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (empty)
    return <p className="text-sm text-slate-500">Sin datos disponibles.</p>;
  return null;
}

function Timestamp({ ts }: { ts: string }) {
  return (
    <p className="px-4 py-2 text-right text-xs text-slate-400">
      Actualizado: {new Date(ts).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })}
    </p>
  );
}

/* ─── Main widget ────────────────────────────────────────────── */

const TABS: { id: Tab; label: string }[] = [
  { id: 'markets', label: 'Mercados' },
  { id: 'assets', label: 'Activos' },
  { id: 'positions', label: 'Posiciones' },
  { id: 'portfolio', label: 'Mi Cartera' },
];

export function MorphoMarketsWidget() {
  const [activeTab, setActiveTab] = useState<Tab>('markets');

  return (
    <section className="mt-14">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Morpho Blue — Dashboard en vivo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ethereum mainnet + Base · datos actualizados cada 5 minutos
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          En vivo
        </span>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === t.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'markets' && <MarketsTab />}
        {activeTab === 'assets' && <AssetsTab />}
        {activeTab === 'positions' && <PositionsTab />}
        {activeTab === 'portfolio' && <PortfolioTab />}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Fuente:{' '}
        <a href="https://app.morpho.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
          Morpho Blue
        </a>{' '}
        · Solo lectura · Sin wallet requerida
      </p>
    </section>
  );
}
