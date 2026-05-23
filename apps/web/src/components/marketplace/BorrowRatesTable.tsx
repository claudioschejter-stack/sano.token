'use client';

import { Percent, Trophy } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { BestBorrowRateResponse } from '../../types/marketplace';

type BorrowRatesTableProps = {
  borrowRate: BestBorrowRateResponse;
};

function formatApy(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function BorrowRatesTable({ borrowRate }: BorrowRatesTableProps) {
  const t = useTranslation();
  const m = t.marketplace;
  const regions = m.lenderRegions as Record<string, string>;
  const categories = m.lenderCategories as Record<string, string>;
  const bestApy = formatApy(borrowRate.best.borrowApyBps);

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-terminal-border bg-terminal-card">
      <div className="border-b border-terminal-border px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-terminal-primary/30 bg-terminal-bg p-2 text-terminal-primary">
              <Percent size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-terminal-text">{m.allBorrowRatesTitle}</h2>
              <p className="mt-1 text-sm text-terminal-muted">{m.allBorrowRatesDesc}</p>
            </div>
          </div>
          <div className="rounded-lg border border-terminal-success/30 bg-terminal-success/5 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-terminal-muted">
              {m.bestBorrowRate}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-terminal-success">{bestApy}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-terminal-muted">
              <Trophy size={12} className="text-terminal-success" />
              {borrowRate.best.name}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-terminal-bg text-xs uppercase tracking-wide text-terminal-muted">
            <tr>
              <th className="px-4 py-3 font-semibold md:px-6">{m.colLender}</th>
              <th className="px-4 py-3 font-semibold">{m.colRegion}</th>
              <th className="px-4 py-3 font-semibold">{m.colCategory}</th>
              <th className="px-4 py-3 font-semibold text-right">{m.colBorrowRate}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-terminal-border">
            {borrowRate.quotes.map((quote) => {
              const isBest = quote.id === borrowRate.best.id;

              return (
                <tr
                  key={quote.id}
                  className={isBest ? 'bg-terminal-success/5' : 'hover:bg-terminal-bg/50'}
                >
                  <td className="px-4 py-3 md:px-6">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-terminal-text">{quote.name}</span>
                      {isBest ? (
                        <span className="rounded border border-terminal-success/40 bg-terminal-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-terminal-success">
                          {m.bestBadge}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-terminal-muted">
                    {regions[quote.region] ?? quote.region}
                  </td>
                  <td className="px-4 py-3 text-terminal-muted">
                    {categories[quote.category] ?? quote.category}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-terminal-text">
                    {formatApy(quote.borrowApyBps)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-terminal-border px-4 py-3 text-xs text-terminal-muted md:px-6">
        {m.lendingRatesFootnote}
      </p>
    </section>
  );
}
