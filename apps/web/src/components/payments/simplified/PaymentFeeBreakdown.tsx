'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';

type Props = {
  /** Base investment amount (before fees) */
  amountUsd: number;
  /** Total to pay including provider fees */
  totalUsd: number;
  /** Provider fee in basis points (e.g. 180 = 1.80%) */
  feeBps: number;
  /** Human-readable provider name (e.g. "Transak", "Bridge") */
  providerLabel: string;
  /** On-chain gas estimate in USD (default 0) */
  networkFeeUsd?: number;
};

function Row({
  label,
  value,
  muted,
  bold
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={muted ? 'text-terminal-muted' : 'text-terminal-text'}>{label}</span>
      <span
        className={
          bold
            ? 'font-semibold text-terminal-text'
            : muted
              ? 'text-terminal-muted'
              : 'text-terminal-text'
        }
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentFeeBreakdown({
  amountUsd,
  totalUsd,
  feeBps,
  providerLabel,
  networkFeeUsd = 0
}: Props) {
  const t = useTranslation();
  const fb = t.simplifiedCheckout.feeBreakdown;
  const [open, setOpen] = useState(false);

  const feeUsd = totalUsd - amountUsd;
  const feePct = (feeBps / 100).toFixed(2);
  const grandTotal = totalUsd + networkFeeUsd;

  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-bg text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-terminal-muted hover:text-terminal-text"
      >
        <span className="font-semibold text-terminal-text">{fb.title}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-terminal-text font-medium">USD {grandTotal.toFixed(2)}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-terminal-border px-3 pb-3 pt-2 space-y-1.5">
          <Row label={fb.investment} value={`USD ${amountUsd.toFixed(2)}`} />
          <Row
            label={`${fb.providerFee} (${providerLabel} ~${feePct}%)`}
            value={feeUsd > 0.005 ? `+ USD ${feeUsd.toFixed(2)}` : 'Incluido'}
            muted
          />
          {networkFeeUsd > 0 && (
            <Row label={fb.networkFee} value={`≈ USD ${networkFeeUsd.toFixed(3)}`} muted />
          )}
          <div className="border-t border-terminal-border pt-1.5">
            <Row label={fb.total} value={`USD ${grandTotal.toFixed(2)}`} bold />
          </div>
          <p className="text-[10px] text-terminal-muted pt-0.5">{fb.paidByBuyer}</p>
        </div>
      )}
    </div>
  );
}
