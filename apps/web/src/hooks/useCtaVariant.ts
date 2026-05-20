'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n/LocaleProvider';

const STORAGE_KEY = 'sanova_cta_variant';

export type CtaVariant = 'invest' | 'reserve';

export function useCtaVariant() {
  const t = useTranslation();
  const [variant, setVariant] = useState<CtaVariant>('invest');

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === 'invest' || stored === 'reserve') {
        setVariant(stored);
        return;
      }

      const assigned: CtaVariant = Math.random() < 0.5 ? 'invest' : 'reserve';
      sessionStorage.setItem(STORAGE_KEY, assigned);
      setVariant(assigned);
    } catch {
      setVariant('invest');
    }
  }, []);

  const label = variant === 'reserve' ? t.common.reserveTokens : t.common.investNow;

  return { variant, label };
}
