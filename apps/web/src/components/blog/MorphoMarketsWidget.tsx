'use client';

import { useEffect, useState } from 'react';

type MorphoMarketState = {
  collateralAssets: string | null;
  collateralAssetsUsd: number | null;
  borrowAssets: string | null;
  borrowAssetsUsd: number | null;
  supplyAssets: string | null;
  supplyAssetsUsd: number | null;
  liquidityAssets: string | null;
  liquidityAssetsUsd: number | null;
  fee: string | null;
  utilization: string | null;
};

type MorphoMarket = {
  marketId: string;
  lltv: string;
  oracle: { address: string } | null;
  irmAddress: string;
  loanAsset: { address: string; symbol: string; decimals: number } | null;
  collateralAsset: { address: string; symbol: string; decimals: number } | null;
  state: MorphoMarketState | null;
  dailyApys: { supplyApy: number | null; borrowApy: number | null } | null;
  chain: { id: number; network: string } | null;
};

type MarketsResponse = {
  markets: MorphoMarket[];
  fetchedAt: string;
};

function usd(val: number | null | undefined): string {
  if (val == null) return '—';
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function apy(val: number | null | undefined): string {
  if (val == null) return '—';
  return `${(val * 100).toFixed(2)}%`;
}

function util(u: string | null | undefined): { label: string; color: string } {
  if (!u) return { label: '—', color: 'text-slate-400' };
  const pct = Number(u) * 100;
  const color = pct > 85 ? 'text-red-600' : pct > 60 ? 'text-amber-600' : 'text-emerald-600';
  return { label: `${pct.toFixed(1)}%`, color };
}

function lltv(val: string | null | undefined): string {
  if (!val) return '—';
  return `${(Number(val) / 1e18 * 100).toFixed(0)}%`;
}

function ChainBadge({ network }: { network: string }) {
  const isBase = network?.toLowerCase().includes('base');
  return (
    <span
      className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold ml-1 ${
        isBase
          ? 'bg-sky-100 text-sky-700'
          : 'bg-violet-100 text-violet-700'
      }`}
    >
      {isBase ? 'Base' : 'Eth'}
    </span>
  );
}

export function MorphoMarketsWidget() {
  const [data, setData] = useState<MarketsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/morpho/markets');
        if (!res.ok) throw new Error('Error al cargar mercados Morpho');
        const json = (await res.json()) as MarketsResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const markets = (data?.markets ?? []).filter(
    (m) => m.loanAsset && m.collateralAsset && m.state
  );

  return (
    <section className="mt-14">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Mercados Morpho Blue en vivo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Top 100 por liquidez · Ethereum mainnet + Base · actualizado cada 5 min
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          En vivo
        </span>
      </div>

      {/* Summary cards */}
      {!loading && !error && markets.length > 0 && (() => {
        const totalSupply = markets.reduce((s, m) => s + (m.state?.supplyAssetsUsd ?? 0), 0);
        const totalBorrow = markets.reduce((s, m) => s + (m.state?.borrowAssetsUsd ?? 0), 0);
        const totalLiquidity = markets.reduce((s, m) => s + (m.state?.liquidityAssetsUsd ?? 0), 0);
        const totalCollateral = markets.reduce((s, m) => s + (m.state?.collateralAssetsUsd ?? 0), 0);

        return (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Supply total', value: usd(totalSupply), color: 'text-blue-700' },
              { label: 'Borrow total', value: usd(totalBorrow), color: 'text-amber-700' },
              { label: 'Liquidez disponible', value: usd(totalLiquidity), color: 'text-emerald-700' },
              { label: 'Colateral total', value: usd(totalCollateral), color: 'text-slate-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className={`mt-1 text-lg font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Loading */}
      {loading && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Cargando mercados…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && markets.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">No hay mercados disponibles en este momento.</p>
      )}

      {/* Table */}
      {!loading && !error && markets.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Par</th>
                <th className="px-4 py-3 text-right">Supply</th>
                <th className="px-4 py-3 text-right">Borrow</th>
                <th className="px-4 py-3 text-right">Liquidez</th>
                <th className="px-4 py-3 text-right">Colateral</th>
                <th className="px-4 py-3 text-right">APY Supply</th>
                <th className="px-4 py-3 text-right">Util.</th>
                <th className="px-4 py-3 text-right">LLTV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {markets.map((m) => {
                const st = m.state!;
                const { label: utilLabel, color: utilColor } = util(st.utilization);

                return (
                  <tr key={m.marketId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                          {m.collateralAsset!.symbol}
                        </span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-700">{m.loanAsset!.symbol}</span>
                        {m.chain && <ChainBadge network={m.chain.network} />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {usd(st.supplyAssetsUsd)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {usd(st.borrowAssetsUsd)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">
                      {usd(st.liquidityAssetsUsd)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {usd(st.collateralAssetsUsd)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {apy(m.dailyApys?.supplyApy)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${utilColor}`}>
                      {utilLabel}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {lltv(m.lltv)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data?.fetchedAt && (
            <p className="px-5 py-2 text-right text-xs text-slate-400">
              Actualizado:{' '}
              {new Date(data.fetchedAt).toLocaleString('es-AR', {
                timeZone: 'America/Argentina/Buenos_Aires',
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Fuente:{' '}
        <a
          href="https://app.morpho.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          Morpho Blue
        </a>{' '}
        · Solo lectura, sin wallet requerida
      </p>
    </section>
  );
}
