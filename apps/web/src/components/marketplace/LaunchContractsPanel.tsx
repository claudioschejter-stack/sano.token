'use client';

import { FileText, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { LaunchContracts } from '../../lib/admin/launchTypes';

type LaunchContractsPanelProps = {
  contracts: LaunchContracts;
  tokenSymbol?: string | null;
};

export function LaunchContractsPanel({ contracts, tokenSymbol }: LaunchContractsPanelProps) {
  const t = useTranslation();
  const c = t.propertyCard.contracts;
  const [open, setOpen] = useState(false);

  const items = [
    { key: 'trust' as const, label: c.trust, url: contracts.trust },
    { key: 'purchase' as const, label: c.purchase, url: contracts.purchase },
    { key: 'lease' as const, label: c.lease, url: contracts.lease },
    { key: 'smartContract' as const, label: c.smartContract, url: contracts.smartContract }
  ].filter((item) => Boolean(item.url));

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg px-4 py-2.5 text-sm font-semibold text-terminal-text transition-colors hover:border-terminal-primary/40 hover:text-terminal-primary"
      >
        <FileText size={16} />
        {c.button}
        {tokenSymbol ? <span className="font-mono text-xs text-terminal-muted">({tokenSymbol})</span> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-terminal-border bg-terminal-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-terminal-text">{c.title}</h3>
                <p className="mt-1 text-sm text-terminal-muted">{c.subtitle}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-terminal-muted hover:text-terminal-text">
                <X size={20} />
              </button>
            </div>
            <ul className="mt-6 space-y-2">
              {items.map((item) => (
                <li key={item.key}>
                  <a
                    href={item.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-sm font-medium text-terminal-primary transition-colors hover:border-terminal-primary/40"
                  >
                    <FileText size={16} />
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
