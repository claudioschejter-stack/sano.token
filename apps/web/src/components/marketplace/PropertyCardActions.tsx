'use client';

import { useTranslation } from '../../i18n/LocaleProvider';
import { PropertyActionButton } from './PropertyActionButton';

export type PropertyCardActionsProps = {
  projectId: string;
  availableTokens: number;
  kycStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  onBuy?: (propertyId: string) => void;
  onStartKyc?: (propertyId: string) => void;
};

export function PropertyCardActions({
  projectId,
  availableTokens,
  kycStatus = 'APPROVED',
  onBuy,
  onStartKyc
}: PropertyCardActionsProps) {
  const t = useTranslation();
  const isSoldOut = availableTokens <= 0;
  const isVerified = kycStatus === 'APPROVED';

  const handlePrimaryAction = () => {
    if (isVerified) {
      onBuy?.(projectId);
      return;
    }

    onStartKyc?.(projectId);
  };

  if (isSoldOut) {
    return (
      <PropertyActionButton variant="soldOut">{t.propertyCard.fullySoldOut}</PropertyActionButton>
    );
  }

  return (
    <PropertyActionButton variant="rent" onClick={handlePrimaryAction}>
      {t.propertyCard.generatesUsdcIncome}
    </PropertyActionButton>
  );
}
