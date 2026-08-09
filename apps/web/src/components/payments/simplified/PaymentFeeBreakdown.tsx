'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { formatUsdPrecise, roundUsdc } from '../../../lib/payments/formatUsdPrecise';

export type FeeBreakdownLine = {
  label: string;
  value: string;
  chargedBy?: string;
  muted?: boolean;
  bold?: boolean;
};

type Props = {
  amountUsd: number;
  totalUsd: number;
  feeBps?: number;
  providerLabel?: string;
  networkFeeUsd?: number;
  networkFeeIncluded?: boolean;
  /** Start expanded so gas/fees are visible without an extra tap. */
  defaultOpen?: boolean;
  /** Who charges the gateway fee (Mercado Pago, Banco Macro, Bridge, etc.) */
  gatewayChargedBy?: string;
  /** Who charges FX/conversion */
  fxChargedBy?: string;
  /** Who charges network gas */
  gasChargedBy?: string;
};

function Row({
  label,
  value,
  chargedBy,
  muted,
  bold
}: {
  label: string;
  value: string;
  chargedBy?: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${muted ? 'text-terminal-muted' : 'text-terminal-text'}`}>{label}</span>
        <span
          className={`text-xs ${bold ? 'font-bold text-terminal-text' : muted ? 'text-terminal-muted' : 'text-terminal-text'}`}
        >
          {value}
        </span>
      </div>
      {chargedBy ? <p className="text-[10px] text-terminal-muted">{chargedBy}</p> : null}
    </div>
  );
}

export function PaymentFeeBreakdown({
  amountUsd,
  totalUsd,
  networkFeeUsd = 0,
  networkFeeIncluded = false,
  defaultOpen = false,
  gatewayChargedBy,
  fxChargedBy,
  gasChargedBy
}: Props) {
  const t = useTranslation();
  const fb = t.simplifiedCheckout.feeBreakdown;
  const [open, setOpen] = useState(defaultOpen || networkFeeUsd > 0);

  const investment = roundUsdc(amountUsd);
  const networkFee = roundUsdc(Math.max(0, networkFeeUsd));
  /**
   * Never trust totalUsd alone when networkFeeIncluded — callers sometimes pass the
   * investment amount while still supplying networkFeeUsd. Always sum the lines.
   */
  const impliedProvider = networkFeeIncluded
    ? roundUsdc(Math.max(0, roundUsdc(totalUsd) - investment - networkFee))
    : roundUsdc(Math.max(0, roundUsdc(totalUsd) - investment));
  const providerFeeUsd = impliedProvider;
  const grandTotal = networkFeeIncluded
    ? roundUsdc(investment + providerFeeUsd + networkFee)
    : roundUsdc(roundUsdc(totalUsd) + networkFee);

  return (
    <div className="rounded-xl border border-terminal-border bg-terminal-bg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-terminal-card/50 transition-colors"
      >
        <span className="text-xs font-semibold text-terminal-text">{fb.title}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold text-terminal-text">USD {formatUsdPrecise(grandTotal)}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-terminal-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-terminal-border px-4 pb-4 pt-3 space-y-2.5">
          <Row
            label={fb.investment}
            value={`USD ${formatUsdPrecise(investment)}`}
            chargedBy={`${fb.chargedByPrefix} ${fb.chargedBySanova}`}
          />
          <Row
            label={fb.providerFee}
            value={providerFeeUsd > 0.0000005 ? `+ USD ${formatUsdPrecise(providerFeeUsd)}` : fb.included}
            chargedBy={
              gatewayChargedBy
                ? `${fb.chargedByPrefix} ${gatewayChargedBy}`
                : `${fb.chargedByPrefix} ${fb.chargedByGateway}`
            }
            muted
          />
          {networkFee > 0 && (
            <Row
              label={fb.networkFee}
              value={`USD ${formatUsdPrecise(networkFee)}`}
              chargedBy={
                gasChargedBy
                  ? `${fb.chargedByPrefix} ${gasChargedBy}`
                  : `${fb.chargedByPrefix} ${fb.chargedByBase}`
              }
              muted
            />
          )}
          <Row
            label={fb.conversionNote}
            value={fb.conversionValue}
            chargedBy={
              fxChargedBy
                ? `${fb.chargedByPrefix} ${fxChargedBy}`
                : `${fb.chargedByPrefix} ${fb.chargedByFx}`
            }
            muted
          />
          <p className="text-[10px] text-terminal-muted">{fb.paidByBuyer}</p>
          <div className="border-t border-terminal-border pt-2.5">
            <Row label={fb.total} value={`USD ${formatUsdPrecise(grandTotal)}`} bold />
          </div>
        </div>
      )}
    </div>
  );
}
