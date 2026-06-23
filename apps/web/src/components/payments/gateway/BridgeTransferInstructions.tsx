'use client';

import { Building2, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildBridgeVirtualAccountInstructions } from '../../../lib/checkout/bridgeVirtualAccountService';
import type { BridgeVirtualAccountInstructions } from '../../../lib/checkout/paymentRouteTypes';

type BridgeTransferInstructionsProps = {
  amountUsd: number;
  referenceId: string;
  investorName?: string;
  labels: {
    title: string;
    subtitle: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    swift: string;
    beneficiaryAddress: string;
    reference: string;
    amount: string;
    memo: string;
    settlement: string;
    copy: string;
    copied: string;
    simulatedNotice: string;
  };
};

function CopyField({
  label,
  value,
  copyLabel,
  copiedLabel
}: {
  label: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-terminal-border bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-terminal-muted">{label}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
        <p className="break-all text-sm text-terminal-text">{value}</p>
        <button
          type="button"
          aria-label={copyLabel}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-md border border-terminal-border p-1.5 text-terminal-muted hover:text-terminal-primary"
        >
          <Copy size={14} />
        </button>
      </div>
      {copied ? <p className="mt-1 text-[10px] text-terminal-success">{copiedLabel}</p> : null}
    </div>
  );
}

export function BridgeTransferInstructions({
  amountUsd,
  referenceId,
  investorName,
  labels
}: BridgeTransferInstructionsProps) {
  const instructions = useMemo<BridgeVirtualAccountInstructions>(
    () => buildBridgeVirtualAccountInstructions({ amountUsd, referenceId, investorName }),
    [amountUsd, investorName, referenceId]
  );

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-2 text-terminal-primary">
          <Building2 size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{labels.title}</h3>
          <p className="mt-1 text-xs text-terminal-muted">{labels.subtitle}</p>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {labels.simulatedNotice}
      </p>

      <div className="mt-4 grid gap-2">
        <CopyField label={labels.bankName} value={instructions.bankName} copyLabel={labels.copy} copiedLabel={labels.copied} />
        <CopyField label={labels.accountName} value={instructions.accountName} copyLabel={labels.copy} copiedLabel={labels.copied} />
        <CopyField label={labels.accountNumber} value={instructions.accountNumber} copyLabel={labels.copy} copiedLabel={labels.copied} />
        <CopyField label={labels.routingNumber} value={instructions.routingNumber} copyLabel={labels.copy} copiedLabel={labels.copied} />
        <CopyField label={labels.swift} value={instructions.swift} copyLabel={labels.copy} copiedLabel={labels.copied} />
        <CopyField label={labels.beneficiaryAddress} value={instructions.beneficiaryAddress} copyLabel={labels.copy} copiedLabel={labels.copied} />
        <CopyField
          label={labels.amount}
          value={`${instructions.currency} ${instructions.amountUsd.toFixed(2)}`}
          copyLabel={labels.copy}
          copiedLabel={labels.copied}
        />
        <CopyField label={labels.reference} value={instructions.reference} copyLabel={labels.copy} copiedLabel={labels.copied} />
        <CopyField label={labels.memo} value={instructions.memo} copyLabel={labels.copy} copiedLabel={labels.copied} />
      </div>

      <p className="mt-3 text-xs text-terminal-muted">
        {labels.settlement}: {instructions.estimatedSettlement}
      </p>
    </section>
  );
}
