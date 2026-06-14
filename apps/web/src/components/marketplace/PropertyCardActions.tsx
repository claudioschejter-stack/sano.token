'use client';

import Link from 'next/link';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { SystemRole } from '../../lib/auth/roles';
import { isMarketplaceTradingRole } from '../../lib/auth/roles';
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
  const isSoldOut = availableTokens <= 0;
  const isVerified = kycStatus === 'APPROVED';
  const canRequestLoan = readyToBorrow && isMarketplaceTradingRole(role) && isVerified;
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
      <PropertyActionButton variant="soldOut">{t.propertyCard.fullySoldOut}</PropertyActionButton>
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
