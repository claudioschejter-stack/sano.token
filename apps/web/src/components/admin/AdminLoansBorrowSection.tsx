'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { BorrowPanel } from '../marketplace/BorrowPanel';
import { BorrowRatesTable } from '../marketplace/BorrowRatesTable';
import type { BestBorrowRateResponse } from '../../types/marketplace';

type AdminLoansBorrowSectionProps = {
  borrowReadyProject?: {
    id: string;
    vaultAddress: string;
  } | null;
};

export function AdminLoansBorrowSection({ borrowReadyProject }: AdminLoansBorrowSectionProps) {
  const t = useTranslation();
  const [borrowRate, setBorrowRate] = useState<BestBorrowRateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetch('/api/marketplace/feed', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { borrowRate?: BestBorrowRateResponse | null }) => {
        setBorrowRate(data.borrowRate ?? null);
      })
      .catch(() => setBorrowRate(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-terminal-muted">{t.adminLoans.loadingRates}</p>;
  }

  if (!borrowRate) {
    return null;
  }

  return (
    <div className="space-y-6">
      <BorrowRatesTable borrowRate={borrowRate} />
      <BorrowPanel
        borrowRate={borrowRate}
        projectId={borrowReadyProject?.id}
        vaultAddress={borrowReadyProject?.vaultAddress}
        readyToBorrow={Boolean(borrowReadyProject)}
      />
    </div>
  );
}
