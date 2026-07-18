'use client';

import { Building2, Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import type { BridgeVirtualAccountInstructions } from '../../../lib/checkout/paymentRouteTypes';

type BridgeTransferInstructionsProps = {
  instructions: BridgeVirtualAccountInstructions;
  /** When true, hides the amber simulated notice (used when live data is available) */
  isSimulated?: boolean;
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
    iban?: string;
    bic?: string;
    clabe?: string;
    sortCode?: string;
    rails?: string;
  };
};

function CopyField({
  label,
  value,
  copyLabel,
  copiedLabel,
  highlight
}: {
  label: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
  highlight?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight
          ? 'border-terminal-primary/40 bg-terminal-primary/5'
          : 'border-terminal-border bg-terminal-bg'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
        {label}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p
          className={`break-all text-sm font-medium leading-snug ${
            highlight ? 'text-terminal-primary' : 'text-terminal-text'
          }`}
        >
          {value}
        </p>
        <button
          type="button"
          aria-label={copyLabel}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-lg border border-terminal-border bg-terminal-card p-1.5 text-terminal-muted transition-colors hover:border-terminal-primary hover:text-terminal-primary"
        >
          {copied ? <CheckCircle2 size={14} className="text-terminal-success" /> : <Copy size={14} />}
        </button>
      </div>
      {copied ? (
        <p className="mt-1 text-[10px] font-medium text-terminal-success">{copiedLabel}</p>
      ) : null}
    </div>
  );
}

export function BridgeTransferInstructions({
  instructions,
  labels
}: BridgeTransferInstructionsProps) {
  const rows: Array<{ label: string; value?: string; highlight?: boolean }> = [
    { label: labels.bankName, value: instructions.bankName },
    { label: labels.accountName, value: instructions.accountName },
    { label: labels.iban ?? 'IBAN', value: instructions.iban },
    { label: labels.bic ?? 'BIC', value: instructions.bic },
    { label: labels.clabe ?? 'CLABE', value: instructions.clabe },
    { label: labels.sortCode ?? 'Sort code', value: instructions.sortCode },
    {
      label: labels.accountNumber,
      value: instructions.iban || instructions.clabe ? undefined : instructions.accountNumber
    },
    {
      label: labels.routingNumber,
      value: instructions.sortCode || instructions.bic ? undefined : instructions.routingNumber
    },
    { label: labels.swift, value: instructions.bic ? undefined : instructions.swift },
    {
      label: labels.amount,
      value: `${instructions.currency} ${instructions.amountUsd.toFixed(2)}`,
      highlight: true
    },
    { label: labels.beneficiaryAddress, value: instructions.beneficiaryAddress },
    { label: labels.reference, value: instructions.reference, highlight: true },
    { label: labels.memo, value: instructions.memo },
    {
      label: labels.rails ?? 'Rails',
      value: instructions.paymentRails?.length ? instructions.paymentRails.join(', ') : undefined
    }
  ];

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-card p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-terminal-primary/30 bg-terminal-primary/10 p-2.5 text-terminal-primary">
          <Building2 size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{labels.title}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">{labels.subtitle}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5">
        {rows.map((row) =>
          row.value && row.value !== '—' ? (
            <CopyField
              key={row.label}
              label={row.label}
              value={row.value}
              copyLabel={labels.copy}
              copiedLabel={labels.copied}
              highlight={row.highlight}
            />
          ) : null
        )}
      </div>

      <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
          {labels.settlement}
        </p>
        <p className="mt-1 text-xs font-medium text-terminal-text">
          {instructions.estimatedSettlement}
        </p>
      </div>
    </section>
  );
}
