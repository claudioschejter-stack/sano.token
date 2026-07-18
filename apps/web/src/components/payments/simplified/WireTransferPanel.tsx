'use client';

import { Building2, Copy, ExternalLink, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { SimplifiedWireMethod } from '../../../lib/payments/checkoutBestRouteService';
import type { BridgeVirtualAccountInstructions } from '../../../lib/checkout/paymentRouteTypes';
import { useDeviceDetection } from '../../../hooks/useDeviceDetection';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';

const QR_SIZE = 200;

type Props = {
  wire: SimplifiedWireMethod;
  amountUsd: number;
  referenceId?: string;
  investorName?: string;
  onPending?: () => void;
};

export function WireTransferPanel({
  wire,
  amountUsd,
  referenceId,
  onPending
}: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const pg = t.paymentGateway;
  const { isDesktop, isMobile } = useDeviceDetection();
  const [instructions, setInstructions] = useState<BridgeVirtualAccountInstructions | null>(null);
  const [vaError, setVaError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const useBridgeVa = wire.provider === 'bridge' || !wire.widgetUrl;

  useEffect(() => {
    if (!referenceId || !useBridgeVa) return;
    onPending?.();
    setVaError(null);
    const params = new URLSearchParams({
      referenceId,
      amountUsd: String(wire.totalUsd)
    });
    void fetch(`/api/payments/bridge-virtual-account?${params}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          instructions?: BridgeVirtualAccountInstructions;
          error?: string;
          isSimulated?: boolean;
        } | null;
        if (!res.ok) {
          setVaError(data?.error ?? sc.notConfigured);
          return;
        }
        if (data?.instructions) setInstructions(data.instructions);
        if (data?.isSimulated) setVaError('SIMULATED_VA');
      })
      .catch(() => setVaError(sc.notConfigured));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceId, wire.totalUsd, useBridgeVa]);

  const copyField = (key: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!wire.configured && !instructions) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-5">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  const transakUrl = wire.provider === 'transak' ? wire.widgetUrl : null;

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-400/10 p-2.5 text-amber-400">
          <Building2 size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{sc.wireTitle}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">{sc.wireSubtitle}</p>
        </div>
      </div>

      <div className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
          {sc.wireTotalToPay}
        </p>
        <p className="mt-1 text-2xl font-bold text-terminal-text">USD {wire.totalUsd.toFixed(2)}</p>
        <p className="mt-0.5 text-[11px] text-terminal-muted">
          {sc.wireReceiveNote.replace('{amount}', amountUsd.toFixed(2))}
        </p>
      </div>

      <PaymentFeeBreakdown
        amountUsd={amountUsd}
        totalUsd={wire.totalUsd}
        gatewayChargedBy={wire.provider === 'bridge' ? 'Bridge' : 'Transak'}
        fxChargedBy={wire.provider === 'bridge' ? 'Bridge' : 'Transak'}
      />

      {vaError && vaError !== 'SIMULATED_VA' ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{vaError}</p>
      ) : null}

      {instructions ? (
        <div className="space-y-2 rounded-xl border border-terminal-border bg-terminal-bg p-4">
          <p className="text-xs font-semibold text-terminal-text">{sc.wireBankInstructionsTitle}</p>
          {(
            [
              [pg.bridgeBankName, instructions.bankName],
              [pg.bridgeAccountName, instructions.accountName],
              [pg.bridgeAccountNumber, instructions.accountNumber],
              [pg.bridgeRoutingNumber, instructions.routingNumber],
              [pg.bridgeSwift, instructions.swift],
              [pg.bridgeReference, instructions.reference],
              [pg.bridgeMemo, instructions.memo]
            ] as Array<[string, string | undefined]>
          ).map(([label, value]) =>
            value ? (
              <div key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-terminal-muted">{label}</span>
                <button
                  type="button"
                  onClick={() => copyField(label, value)}
                  className="inline-flex items-center gap-1 font-mono text-terminal-text"
                >
                  {value}
                  <Copy size={12} />
                  {copied === label ? <span className="text-terminal-success">{pg.copied}</span> : null}
                </button>
              </div>
            ) : null
          )}
          <p className="pt-1 text-[11px] text-terminal-muted">{instructions.estimatedSettlement}</p>
          <p className="text-[11px] text-terminal-muted">{sc.wireAwaitingSettlement}</p>
        </div>
      ) : null}

      {isDesktop && transakUrl ? (
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
          <p className="text-center text-[11px] text-terminal-muted">{sc.wireScanToStart}</p>
          <a
            href={transakUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-terminal-primary"
          >
            <ExternalLink size={12} />
            {sc.wireOpenInBrowser}
          </a>
        </div>
      ) : null}

      {isMobile && transakUrl ? (
        <a
          href={transakUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-terminal-primary px-4 py-3 text-sm font-semibold text-white"
        >
          <Smartphone size={16} />
          {sc.wireStartTransferMobile}
        </a>
      ) : null}
    </section>
  );
}
