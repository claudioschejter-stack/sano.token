'use client';

import { useEffect, useMemo, useState } from 'react';
import { intlLocaleByCode, type Locale } from '../i18n';
import { useLocale } from '../i18n/LocaleProvider';

type FxRatesResponse = {
  base: string;
  rates: Record<string, number>;
};

const LOCALE_CURRENCY: Record<Locale, string> = {
  en: 'USD',
  zh: 'CNY',
  hi: 'INR',
  es: 'ARS',
  fr: 'EUR',
  ar: 'USD',
  bn: 'BDT',
  pt: 'BRL',
  ru: 'RUB',
  ur: 'PKR',
  id: 'IDR',
  de: 'EUR',
  ja: 'JPY',
  sw: 'KES',
  mr: 'INR'
};

const FALLBACK_FX: Record<string, number> = {
  USD: 1,
  ARS: 1050,
  EUR: 0.92,
  BRL: 5.1,
  RUB: 92,
  CNY: 7.2,
  INR: 83,
  BDT: 110,
  PKR: 278,
  IDR: 15800,
  JPY: 150,
  KES: 130
};

async function fetchFxRates(): Promise<Record<string, number>> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');

    if (!response.ok) {
      return FALLBACK_FX;
    }

    const payload = (await response.json()) as FxRatesResponse;
    return { USD: 1, ...payload.rates };
  } catch {
    return FALLBACK_FX;
  }
}

export function useLocalCurrency() {
  const { locale } = useLocale();
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_FX);

  const currency = LOCALE_CURRENCY[locale] ?? 'USD';
  const intlLocale = intlLocaleByCode[locale] ?? 'en-US';

  useEffect(() => {
    let cancelled = false;

    void fetchFxRates().then((nextRates) => {
      if (!cancelled) {
        setRates(nextRates);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }),
    [currency, intlLocale]
  );

  const convertFromUsd = (amountUsd: number) => {
    const rate = rates[currency] ?? 1;
    return amountUsd * rate;
  };

  const formatFromUsd = (amountUsd: number) => formatter.format(convertFromUsd(amountUsd));

  const formatUsd = (amountUsd: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amountUsd);

  const formatPercent = (
    apyPercent: number,
    fractionDigits: { minimum?: number; maximum?: number } = {}
  ) =>
    new Intl.NumberFormat(intlLocale, {
      style: 'percent',
      minimumFractionDigits: fractionDigits.minimum ?? 1,
      maximumFractionDigits: fractionDigits.maximum ?? 1
    }).format(apyPercent / 100);

  return {
    currency,
    intlLocale,
    rates,
    convertFromUsd,
    formatFromUsd,
    formatUsd,
    formatPercent
  };
}
