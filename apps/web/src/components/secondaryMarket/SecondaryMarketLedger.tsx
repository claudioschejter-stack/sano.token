'use client';

import type { SecondaryMarketOrder, SecondaryMarketPlatformBuyback } from '../../types/secondaryMarket';

type LedgerRow = {
  id: string;
  pricePerTokenUsd: number;
  tokenCount: number;
  symbol: string;
  label?: string;
  isOwn?: boolean;
};

type SecondaryMarketLedgerProps = {
  buyLabel: string;
  sellLabel: string;
  colPrice: string;
  colQty: string;
  colAsset: string;
  emptyBuy: string;
  emptySell: string;
  ownListingHint: string;
  platformBuyback: SecondaryMarketPlatformBuyback;
  sellOrders: SecondaryMarketOrder[];
  tokenSymbol: string;
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
  colAsset,
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
  colAsset: string;
  emptyLabel: string;
  formatUsd: (value: number) => string;
  formatQty: (value: number) => string;
  ownListingHint?: string;
  onSelect: (row: LedgerRow) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="border-b border-terminal-border bg-terminal-bg/80 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-terminal-muted">
        {title}
      </div>
      <div className="grid grid-cols-3 place-items-center border-b border-terminal-border bg-terminal-bg/50 px-2 py-1 text-center text-[10px] uppercase tracking-wide text-terminal-muted">
        <span>{colPrice}</span>
        <span>{colQty}</span>
        <span>{colAsset}</span>
      </div>
      {rows.length ? (
        <div className="max-h-40 overflow-y-auto">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row)}
              className={`grid w-full grid-cols-3 place-items-center border-b border-terminal-border/70 px-2 py-1.5 text-center text-[11px] font-mono transition-colors hover:bg-terminal-primary/10 ${
                row.isOwn ? 'bg-terminal-warning/5 hover:bg-terminal-warning/10' : ''
              }`}
            >
              <span className="w-full font-semibold text-terminal-primary">{formatUsd(row.pricePerTokenUsd)}</span>
              <span className="w-full text-terminal-text">{formatQty(row.tokenCount)}</span>
              <span className="w-full min-w-0 truncate text-terminal-muted">
                {row.isOwn && ownListingHint ? ownListingHint : row.symbol}
              </span>
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
  colAsset,
  emptyBuy,
  emptySell,
  ownListingHint,
  platformBuyback,
  sellOrders,
  tokenSymbol,
  formatUsd,
  formatQty,
  onSelectBuy,
  onSelectSell
}: SecondaryMarketLedgerProps) {
  const buyRows: LedgerRow[] = [
    {
      id: platformBuyback.id,
      pricePerTokenUsd: platformBuyback.pricePerTokenUsd,
      tokenCount: 1,
      symbol: tokenSymbol,
      label: platformBuyback.label
    }
  ].sort((a, b) => b.pricePerTokenUsd - a.pricePerTokenUsd);

  const sellRows: LedgerRow[] = sellOrders
    .map((order) => ({
      id: order.id,
      pricePerTokenUsd: order.pricePerTokenUsd,
      tokenCount: order.tokenCount,
      symbol: tokenSymbol,
      isOwn: order.isOwnListing
    }))
    .sort((a, b) => a.pricePerTokenUsd - b.pricePerTokenUsd);

  return (
    <div className="grid grid-cols-2 divide-x divide-terminal-border">
      <LedgerColumn
        title={buyLabel}
        rows={buyRows}
        colPrice={colPrice}
        colQty={colQty}
        colAsset={colAsset}
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
        colAsset={colAsset}
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
