'use client';

import { Building2, ExternalLink, Smartphone } from 'lucide-react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { SimplifiedWireMethod } from '../../../lib/payments/checkoutBestRouteService';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';

const QR_SIZE = 200;

type Props = {
  wire: SimplifiedWireMethod;
  amountUsd: number;
};

export function WireTransferPanel({ wire, amountUsd }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { isDesktop } = useDeviceDetection();

  if (!wire.configured || !wire.widgetUrl) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-5">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  const transakUrl = wire.widgetUrl;

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-400/10 p-2.5 text-amber-400">
          <Building2 size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{sc.wireTitle}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">
            SEPA · ACH · Transferencia local
          </p>
        </div>
      </div>

      {/* Amount */}
      <div className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
          {sc.wireTotalToPay}
        </p>
        <p className="mt-1 text-2xl font-bold text-terminal-text">
          USD {wire.totalUsd.toFixed(2)}
        </p>
        <p className="mt-0.5 text-[11px] text-terminal-muted">
          {sc.wireReceiveNote.replace('{amount}', amountUsd.toFixed(2))}
        </p>
      </div>

      {/* Fee breakdown */}
      <PaymentFeeBreakdown amountUsd={amountUsd} totalUsd={wire.totalUsd} />

      {/* Desktop: QR code */}
      {isDesktop && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-terminal-border bg-terminal-bg p-4">
          <div className="rounded-lg border-4 border-white bg-white p-1 shadow-lg">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=8&data=${encodeURIComponent(transakUrl)}`}
              alt={sc.wireQrAlt}
              width={QR_SIZE}
              height={QR_SIZE}
              className="block rounded"
            />
          </div>
          <p className="text-center text-[11px] text-terminal-muted">
            {sc.wireScanToStart}
          </p>
          <a
            href={transakUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-terminal-primary hover:underline"
          >
            {sc.wireOpenInBrowser} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Mobile: redirect button */}
      {!isDesktop && (
        <a
          href={transakUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-amber-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-amber-900/30 transition-all hover:bg-amber-500 active:scale-[0.98]"
        >
          <Smartphone className="h-4 w-4" />
          {sc.wireStartTransferMobile}
        </a>
      )}
    </section>
  );
}
