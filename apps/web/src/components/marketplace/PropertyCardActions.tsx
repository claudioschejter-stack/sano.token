'use client';

import { ArrowLeftRight, Landmark, ShieldAlert, Wallet } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { SystemRole } from '../../lib/auth/roles';
import type { SecondaryMarketHolding } from '../../types/secondaryMarket';
import { PropertyActionButton } from './PropertyActionButton';

export type PropertyCardActionsProps = {
  projectId: string;
  availableTokens: number;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  role?: SystemRole;
  investorHolding?: SecondaryMarketHolding | null;
  readyToBorrow?: boolean;
  purchaseEnabled?: boolean;
  staffPreviewHint?: string;
  mutedTextClass?: string;
  onBuy?: (propertyId: string) => void;
  onStartKyc?: (propertyId: string) => void;
};

export function PropertyCardActions({
  projectId,
  availableTokens,
  kycStatus,
  role,
  investorHolding,
  readyToBorrow = false,
  purchaseEnabled = true,
  staffPreviewHint,
  mutedTextClass = 'text-terminal-muted',
  onBuy,
  onStartKyc
}: PropertyCardActionsProps) {
  const t = useTranslation();
  const pc = t.propertyCard;

  const isSoldOut = availableTokens <= 0;
  const isInvestor = role === 'INVESTOR';
  const isGuest = !role;
  const isVerified = kycStatus === 'APPROVED';
  const canAccessPrimaryBuy = isVerified || isGuest;
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
  const showGuestOrStaffBuy = !isInvestor && canAccessPrimaryBuy && !isSoldOut;
  const showInvestorSoldOut = isInvestor && !hasHolding && isSoldOut;
  const showGuestOrStaffSoldOut = !isInvestor && isSoldOut;
  const showInvestorSellBorrow = isInvestor && isVerified && hasHolding;
  const showKycGate = isInvestor && !isVerified && !isSoldOut;

  const primaryBuyLabel = isInvestor || !role ? t.common.investNow : pc.staffCta;

  return (
    <>
      <p className={`min-h-10 line-clamp-2 text-xs ${mutedTextClass}`}>
        {isSoldOut && !hasHolding
          ? pc.soldOutHint
          : isVerified
            ? pc.readyForCheckout
            : isGuest
              ? pc.readyForCheckout
              : pc.kycRequired}
      </p>

      <div className="space-y-2.5">
        {showGuestOrStaffSoldOut || showInvestorSoldOut ? (
          <PropertyActionButton variant="soldOut">{pc.soldOut}</PropertyActionButton>
        ) : null}

        {showGuestOrStaffBuy ? (
          <PropertyActionButton variant={role ? 'staff' : 'rent'} onClick={handlePrimaryAction}>
            <Wallet size={18} />
            {primaryBuyLabel}
          </PropertyActionButton>
        ) : null}

        {showInvestorBuy ? (
          <PropertyActionButton variant="rent" onClick={handlePrimaryAction}>
            <Wallet size={18} />
            {t.common.investNow}
          </PropertyActionButton>
        ) : null}

        {showKycGate ? (
          <PropertyActionButton variant="kyc" onClick={handlePrimaryAction}>
            <ShieldAlert size={18} />
            {t.common.completeKyc}
          </PropertyActionButton>
        ) : null}

        {showInvestorSellBorrow ? (
          <>
            {canSell ? (
              <PropertyActionButton
                variant="sell"
                href={`/mercado-secundario?sell=${encodeURIComponent(projectId)}`}
              >
                <ArrowLeftRight size={18} />
                {pc.sellTokens}
              </PropertyActionButton>
            ) : (
              <PropertyActionButton variant="sell" disabled>
                <ArrowLeftRight size={18} />
                {pc.sellTokens}
              </PropertyActionButton>
            )}
            <PropertyActionButton
              variant="loan"
              href={`/marketplace/${projectId}/prestamo`}
              className={readyToBorrow ? '' : 'opacity-80'}
            >
              <Landmark size={18} />
              {pc.requestLoan}
            </PropertyActionButton>
          </>
        ) : null}
      </div>
    </>
  );
}
