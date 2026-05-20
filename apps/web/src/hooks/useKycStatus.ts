'use client';

import { useEffect, useState } from 'react';

const KYC_STORAGE_KEY = 'sanova.kycStatus';

export type KycStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED';

export function useKycStatus() {
  const [kycStatus, setKycStatus] = useState<KycStatusValue>('PENDING');

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = window.localStorage.getItem(KYC_STORAGE_KEY) as KycStatusValue | null;
      if (stored === 'PENDING' || stored === 'APPROVED' || stored === 'REJECTED') {
        setKycStatus(stored);
      }
    };

    syncFromStorage();
    window.addEventListener('sanova:kyc-updated', syncFromStorage);
    return () => window.removeEventListener('sanova:kyc-updated', syncFromStorage);
  }, []);

  return kycStatus;
}

export function setDemoKycStatus(status: KycStatusValue) {
  window.localStorage.setItem(KYC_STORAGE_KEY, status);
  window.dispatchEvent(new Event('sanova:kyc-updated'));
}
