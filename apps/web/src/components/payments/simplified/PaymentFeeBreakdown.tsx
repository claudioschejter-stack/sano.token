'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';

type Props = {
  amountUsd: number;
  totalUsd: number;
  feeBps?: number;
  providerLabel?: string;
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
      <span className={`text-xs ${muted ? 'text-terminal-muted' : 'text-terminal-text'}`}>{label}</span>
      <span
        className={`text-xs ${bold ? 'font-bold text-terminal-text' : muted ? 'text-terminal-muted' : 'text-terminal-text'}`}
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentFeeBreakdown({
  amountUsd,
  totalUsd,
  networkFeeUsd = 0
}: Props) {
  const t = useTranslation();
  const fb = t.simplifiedCheckout.feeBreakdown;
  const [open, setOpen] = useState(false);

  const feeUsd = totalUsd - amountUsd;
  const grandTotal = totalUsd + networkFeeUsd;

  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-bg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-terminal-card/50 transition-colors"
      >
        <span className="text-xs font-semibold text-terminal-text">{fb.title}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold text-terminal-text">USD {grandTotal.toFixed(2)}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-terminal-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-terminal-border px-4 pb-4 pt-3 space-y-2.5">
          <Row label={fb.investment} value={`USD ${amountUsd.toFixed(2)}`} />
          <Row
            label={fb.providerFee}
            value={feeUsd > 0.005 ? `+ USD ${feeUsd.toFixed(2)}` : 'Incluido'}
            muted
          />
          {networkFeeUsd > 0 && (
            <Row label={fb.networkFee} value={`≈ USD ${networkFeeUsd.toFixed(3)}`} muted />
          )}
          <div className="border-t border-terminal-border pt-2.5">
            <Row label={fb.total} value={`USD ${grandTotal.toFixed(2)}`} bold />
          </div>
        </div>
      )}
    </div>
  );
}
