'use client';

import Link from 'next/link';
import { ArrowLeftRight, Landmark, ShieldAlert, Wallet } from 'lucide-react';
import { useCtaVariant } from '../../hooks/useCtaVariant';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { SystemRole } from '../../lib/auth/roles';
import type { SecondaryMarketHolding } from '../../types/secondaryMarket';

export type PropertyCardActionsProps = {
  projectId: string;
  availableTokens: number;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  role?: SystemRole;
  investorHolding?: SecondaryMarketHolding | null;
  readyToBorrow?: boolean;
  purchaseEnabled?: boolean;
  staffPreviewHint?: string;
  onBuy?: (propertyId: string) => void;
  onStartKyc?: (propertyId: string) => void;
};

const primaryButtonClass =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold transition-all duration-200 sm:text-sm';

const secondaryButtonClass =
  'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2.5 text-sm font-medium text-terminal-text transition-colors hover:border-terminal-primary/40 hover:text-terminal-primary';

function SoldOutButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className={`${primaryButtonClass} cursor-default bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-[0_8px_24px_rgba(236,72,153,0.28)]`}
    >
      {label}
    </button>
  );
}

export function PropertyCardActions({
  projectId,
  availableTokens,
  kycStatus,
  role,
  investorHolding,
  readyToBorrow = false,
  purchaseEnabled = true,
  staffPreviewHint,
  onBuy,
  onStartKyc
}: PropertyCardActionsProps) {
  const t = useTranslation();
  const pc = t.propertyCard;
  const { label: investorCtaLabel } = useCtaVariant();

  const isSoldOut = availableTokens <= 0;
  const isInvestor = role === 'INVESTOR';
  const isVerified = kycStatus === 'APPROVED';
  const hasHolding = (investorHolding?.ownedTokens ?? 0) > 0;
  const canSell = (investorHolding?.availableToSell ?? 0) > 0;

  const handlePrimaryAction = () => {
    if (isVerified) {
      onBuy?.(projectId);
      return;
    }
    onStartKyc?.(projectId);
  };

  if (!purchaseEnabled) {
    return staffPreviewHint ? (
      <p className="rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs text-terminal-muted">
        {staffPreviewHint}
      </p>
    ) : null;
  }

  const showInvestorBuy = isInvestor && isVerified && !isSoldOut;
  const showStaffBuy = !isInvestor && isVerified && !isSoldOut;
  const showInvestorSoldOut = isInvestor && !hasHolding && isSoldOut;
  const showStaffSoldOut = !isInvestor && isSoldOut;
  const showInvestorSellBorrow = isInvestor && isVerified && hasHolding;
  const showKycGate = isInvestor && !isVerified && !isSoldOut;

  return (
    <>
      <p className="text-xs text-terminal-muted">
        {isSoldOut && !hasHolding
          ? pc.soldOutHint
          : isVerified
            ? pc.readyForCheckout
            : pc.kycRequired}
      </p>

      <div className="space-y-2.5">
        {showStaffSoldOut || showInvestorSoldOut ? <SoldOutButton label={pc.soldOut} /> : null}

        {showStaffBuy ? (
          <button
            type="button"
            onClick={handlePrimaryAction}
            className={`${primaryButtonClass} bg-terminal-primary text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-terminal-primary/25`}
          >
            <Wallet size={18} />
            {pc.staffCta}
          </button>
        ) : null}

        {showInvestorBuy ? (
          <button
            type="button"
            onClick={handlePrimaryAction}
            className={`${primaryButtonClass} bg-terminal-primary text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-terminal-primary/25`}
          >
            <Wallet size={18} />
            {investorCtaLabel}
          </button>
        ) : null}

        {showKycGate ? (
          <button
            type="button"
            onClick={handlePrimaryAction}
            className={`${primaryButtonClass} border border-terminal-warning/50 bg-terminal-bg text-terminal-warning hover:bg-terminal-warning/10`}
          >
            <ShieldAlert size={18} />
            {t.common.completeKyc}
          </button>
        ) : null}

        {showInvestorSellBorrow ? (
          <div className="flex gap-2">
            {canSell ? (
              <Link
                href={`/mercado-secundario?sell=${encodeURIComponent(projectId)}`}
                className={secondaryButtonClass}
              >
                <ArrowLeftRight size={16} />
                {pc.sellTokens}
              </Link>
            ) : (
              <span className={`${secondaryButtonClass} cursor-not-allowed opacity-50`}>{pc.sellTokens}</span>
            )}
            <Link
              href={`/marketplace/${projectId}/prestamo`}
              className={`${secondaryButtonClass}${readyToBorrow ? '' : ' opacity-70'}`}
            >
              <Landmark size={16} />
              {pc.requestLoan}
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
