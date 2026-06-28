'use client';

import { useEffect, useState } from 'react';

type MorphoMarket = {
  marketId: string;
  lltv: string;
  oracle: { address: string } | null;
  irmAddress: string;
  loanAsset: { address: string; symbol: string; decimals: number } | null;
  collateralAsset: { address: string; symbol: string; decimals: number } | null;
  state: {
    borrowAssets: string;
    supplyAssets: string;
    fee: string;
    utilization: string;
  } | null;
};

type MarketsResponse = {
  markets: MorphoMarket[];
  fetchedAt: string;
};

function formatAssets(rawAssets: string | null | undefined, decimals: number): string {
  if (!rawAssets) return '—';
  const n = Number(rawAssets) / 10 ** decimals;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatUtilization(u: string | null | undefined): string {
  if (!u) return '—';
  return `${(Number(u) * 100).toFixed(1)}%`;
}

function formatLltv(lltv: string | null | undefined): string {
  if (!lltv) return '—';
  return `${(Number(lltv) / 1e18 * 100).toFixed(0)}%`;
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

  // Only show markets with known loan and collateral assets
  const markets = (data?.markets ?? []).filter(
    (m) => m.loanAsset && m.collateralAsset && m.state
  );

  return (
    <section className="mt-14">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">
          Mercados Morpho Blue en vivo
        </h2>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          En vivo
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Datos en tiempo real de los mercados de préstamos descentralizados donde Sanova opera liquidez.
      </p>

      {loading && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Cargando mercados…
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && markets.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">No hay mercados disponibles en este momento.</p>
      )}

      {!loading && !error && markets.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-slate-600">Par</th>
                <th className="px-5 py-3 text-right font-semibold text-slate-600">Supply</th>
                <th className="px-5 py-3 text-right font-semibold text-slate-600">Borrow</th>
                <th className="px-5 py-3 text-right font-semibold text-slate-600">Utilización</th>
                <th className="px-5 py-3 text-right font-semibold text-slate-600">LLTV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {markets.slice(0, 20).map((m) => {
                const loan = m.loanAsset!;
                const collateral = m.collateralAsset!;
                const state = m.state!;
                const utilPct = Number(state.utilization);
                const utilColor =
                  utilPct > 0.85
                    ? 'text-red-600'
                    : utilPct > 0.6
                    ? 'text-amber-600'
                    : 'text-emerald-600';

                return (
                  <tr key={m.marketId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                          {collateral.symbol}
                        </span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-700">{loan.symbol}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700">
                      {formatAssets(state.supplyAssets, loan.decimals)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700">
                      {formatAssets(state.borrowAssets, loan.decimals)}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${utilColor}`}>
                      {formatUtilization(state.utilization)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {formatLltv(m.lltv)}
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
                timeStyle: 'short'
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
        · Datos actualizados cada 5 minutos · Solo lectura, sin wallet requerida
      </p>
    </section>
  );
}
