'use client';

import { useEffect, useMemo, useState } from 'react';
import { readCountryHint } from '../i18n/detectLocale';
import { normalizePaymentCountry } from '../lib/payments/paymentCountry';

const CURRENCY_COUNTRY: Record<string, string> = {
  ARS: 'AR',
  BRL: 'BR',
  USD: 'US',
  EUR: 'EU',
  INR: 'IN',
  MXN: 'MX',
  CNY: 'CN'
};

export function useCheckoutPaymentCountry(fallbackCurrency: string): string {
  const [cookieCountry, setCookieCountry] = useState<string | null>(null);

  useEffect(() => {
    setCookieCountry(readCountryHint());
  }, []);

  return useMemo(() => {
    const fromCookie = cookieCountry ? normalizePaymentCountry(cookieCountry) : null;
    if (fromCookie) {
      return fromCookie;
    }
    return normalizePaymentCountry(CURRENCY_COUNTRY[fallbackCurrency] ?? 'AR');
  }, [cookieCountry, fallbackCurrency]);
}
