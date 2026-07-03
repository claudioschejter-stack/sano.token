'use client';

import type { SecondaryMarketOrder, SecondaryMarketPlatformBuyback } from '../../types/secondaryMarket';

type LedgerRow = {
  id: string;
  pricePerTokenUsd: number;
  tokenCount: number;
  isOwn?: boolean;
};

type SecondaryMarketLedgerProps = {
  buyLabel: string;
  sellLabel: string;
  colPrice: string;
  colQty: string;
  emptyBuy: string;
  emptySell: string;
  ownListingHint: string;
  platformBuyback: SecondaryMarketPlatformBuyback;
  sellOrders: SecondaryMarketOrder[];
  formatUsd: (value: number) => string;
  formatQty: (value: number) => string;
  onSelectBuy: (buyback: SecondaryMarketPlatformBuyback) => void;
  onSelectSell: (order: SecondaryMarketOrder) => void;
};

function LedgerColumn({
  title,
  rows,
  colPrice,
  colQty,
  emptyLabel,
  formatUsd,
  formatQty,
  ownListingHint,
  onSelect
}: {
  title: string;
  rows: LedgerRow[];
  colPrice: string;
  colQty: string;
  emptyLabel: string;
  formatUsd: (value: number) => string;
  formatQty: (value: number) => string;
  ownListingHint?: string;
  onSelect: (row: LedgerRow) => void;
}) {
  const columnGridClass = 'grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]';

  return (
    <div className="min-w-0">
      <div className="border-b border-terminal-border bg-terminal-bg/80 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-terminal-text">
        {title}
      </div>
      <div
        className={`${columnGridClass} items-stretch border-b border-terminal-border bg-terminal-bg/50 px-2 py-1 text-center text-[10px] uppercase tracking-wide text-terminal-text`}
      >
        <span className="flex items-center justify-center">{colPrice}</span>
        <div className="bg-gray-500/80" aria-hidden />
        <span className="flex items-center justify-center">{colQty}</span>
      </div>
      {rows.length ? (
        <div className="max-h-40 overflow-y-auto">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row)}
              className={`${columnGridClass} w-full items-stretch border-b border-terminal-border px-2 py-1.5 text-center text-[11px] font-mono transition-colors hover:bg-terminal-primary/10 ${
                row.isOwn ? 'bg-terminal-warning/5 hover:bg-terminal-warning/10' : ''
              }`}
            >
              <span className="flex flex-col items-center justify-center font-semibold text-terminal-primary">
                {formatUsd(row.pricePerTokenUsd)}
                {row.isOwn && ownListingHint ? (
                  <span className="mt-0.5 block text-[9px] font-sans font-normal text-terminal-warning">
                    {ownListingHint}
                  </span>
                ) : null}
              </span>
              <div className="bg-gray-500/70" aria-hidden />
              <span className="flex items-center justify-center text-terminal-text">{formatQty(row.tokenCount)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="px-2 py-3 text-center text-[11px] text-terminal-muted">{emptyLabel}</p>
      )}
    </div>
  );
}

export function SecondaryMarketLedger({
  buyLabel,
  sellLabel,
  colPrice,
  colQty,
  emptyBuy,
  emptySell,
  ownListingHint,
  platformBuyback,
  sellOrders,
  formatUsd,
  formatQty,
  onSelectBuy,
  onSelectSell
}: SecondaryMarketLedgerProps) {
  const buyRows: LedgerRow[] = [
    {
      id: platformBuyback.id,
      pricePerTokenUsd: platformBuyback.pricePerTokenUsd,
      tokenCount: 1
    }
  ].sort((a, b) => b.pricePerTokenUsd - a.pricePerTokenUsd);

  const sellRows: LedgerRow[] = sellOrders
    .map((order) => ({
      id: order.id,
      pricePerTokenUsd: order.pricePerTokenUsd,
      tokenCount: order.tokenCount,
      isOwn: order.isOwnListing
    }))
    .sort((a, b) => a.pricePerTokenUsd - b.pricePerTokenUsd);

  return (
    <div className="grid grid-cols-2 divide-x divide-terminal-border border-t border-terminal-border bg-terminal-bg/30">
      <LedgerColumn
        title={buyLabel}
        rows={buyRows}
        colPrice={colPrice}
        colQty={colQty}
        emptyLabel={emptyBuy}
        formatUsd={formatUsd}
        formatQty={formatQty}
        onSelect={() => onSelectBuy(platformBuyback)}
      />
      <LedgerColumn
        title={sellLabel}
        rows={sellRows}
        colPrice={colPrice}
        colQty={colQty}
        emptyLabel={emptySell}
        formatUsd={formatUsd}
        formatQty={formatQty}
        ownListingHint={ownListingHint}
        onSelect={(row) => {
          const order = sellOrders.find((entry) => entry.id === row.id);
          if (order) {
            onSelectSell(order);
          }
        }}
      />
    </div>
  );
}
