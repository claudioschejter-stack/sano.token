'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { SystemRole } from '../../lib/auth/roles';
import { isMarketplaceTradingRole } from '../../lib/auth/roles';
import { useLoansPreference } from '../../hooks/useLoansPreference';
import { PropertyActionButton } from './PropertyActionButton';

export type PropertyCardActionsProps = {
  projectId: string;
  availableTokens: number;
  kycStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  role?: SystemRole;
  readyToBorrow?: boolean;
  purchaseEnabled?: boolean;
  onBuy?: (propertyId: string) => void;
  onStartKyc?: (propertyId: string) => void;
};

// fix: 11 inline waitlist form shown under sold-out properties
function WaitlistForm({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: email,
          email,
          message: `Waitlist: ${projectId}. El usuario quiere ser notificado cuando haya disponibilidad.`,
          type: 'waitlist',
          propertyId: projectId
        })
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs font-medium text-emerald-400">
        ✓ Te avisaremos cuando haya disponibilidad
      </p>
    );
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="mt-2 space-y-1.5">
      <input
        type="email"
        required
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm text-terminal-text placeholder:text-terminal-muted focus:border-terminal-primary focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary transition hover:bg-terminal-primary/20 disabled:opacity-50"
      >
        {status === 'sending' ? 'Enviando…' : 'Confirmar'}
      </button>
      {status === 'error' && (
        <p className="text-center text-xs text-red-400">Error al enviar. Intentá de nuevo.</p>
      )}
    </form>
  );
}

export function PropertyCardActions({
  projectId,
  availableTokens,
  kycStatus = 'APPROVED',
  role,
  readyToBorrow = false,
  purchaseEnabled = true,
  onBuy,
  onStartKyc
}: PropertyCardActionsProps) {
  const t = useTranslation();
  const [showWaitlist, setShowWaitlist] = useState(false);
  const { loansEnabled } = useLoansPreference();
  const isSoldOut = availableTokens <= 0;
  const isVerified = kycStatus === 'APPROVED';
  const canRequestLoan = loansEnabled && readyToBorrow && isMarketplaceTradingRole(role) && isVerified;
  const canPurchase = !isSoldOut && purchaseEnabled;

  const handlePrimaryAction = () => {
    if (isVerified) {
      onBuy?.(projectId);
      return;
    }

    onStartKyc?.(projectId);
  };

  if (isSoldOut && !canRequestLoan) {
    return (
      <div className="space-y-2">
        <PropertyActionButton variant="soldOut">{t.propertyCard.fullySoldOut}</PropertyActionButton>
        {/* fix: 11 secondary CTA for waitlist on sold-out properties */}
        {!showWaitlist ? (
          <button
            type="button"
            onClick={() => setShowWaitlist(true)}
            className="w-full rounded-lg border border-terminal-border px-4 py-2 text-xs font-medium text-terminal-muted transition hover:border-terminal-primary/40 hover:text-terminal-primary"
          >
            Avisarme cuando haya disponibilidad
          </button>
        ) : (
          <WaitlistForm projectId={projectId} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {canPurchase ? (
        <PropertyActionButton variant="rent" onClick={handlePrimaryAction}>
          {t.propertyCard.generatesUsdcIncome}
        </PropertyActionButton>
      ) : isSoldOut ? (
        <PropertyActionButton variant="soldOut">{t.propertyCard.fullySoldOut}</PropertyActionButton>
      ) : null}
      {canRequestLoan ? (
        <Link
          href={`/marketplace/${projectId}/prestamo`}
          className="inline-flex items-center justify-center rounded-lg border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2.5 text-sm font-semibold text-terminal-primary transition-colors hover:bg-terminal-primary/20"
        >
          {t.propertyCard.requestLoan}
        </Link>
      ) : null}
    </div>
  );
}
