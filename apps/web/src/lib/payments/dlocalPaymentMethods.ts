/** Maps checkout catalog rails to dLocal `payment_method_id` values (see docs.dlocal.com/docs/argentina). */
export function mapDLocalPaymentMethodId(country: string, providerRail: string): string {
  const normalizedCountry = country.trim().toUpperCase();
  const rail = providerRail.trim().toLowerCase();

  if (normalizedCountry === 'AR') {
    switch (rail) {
      case 'modo_qr':
        return 'MU';
      case 'bank_transfer_ar':
        return 'IO';
      case 'card':
        return 'CARD';
      case 'wallet':
        return 'QR';
      default:
        break;
    }
  }

  if (normalizedCountry === 'BR' && rail === 'pix') {
    return 'PQ';
  }

  if (normalizedCountry === 'MX' && rail === 'spei') {
    return 'SE';
  }

  if (providerRail.length <= 3 && /^[A-Z0-9]+$/i.test(providerRail)) {
    return providerRail.toUpperCase();
  }

  return 'CARD';
}

const DLOCAL_LOCAL_CURRENCY: Record<string, string> = {
  AR: 'ARS',
  BR: 'BRL',
  MX: 'MXN',
  IN: 'INR'
};

const DLOCAL_FX_ENV_KEYS: Record<string, string> = {
  ARS: 'DLOCAL_FX_ARS',
  BRL: 'DLOCAL_FX_BRL',
  MXN: 'DLOCAL_FX_MXN',
  INR: 'DLOCAL_FX_INR'
};

const DLOCAL_FX_DEFAULTS: Record<string, number> = {
  ARS: 1050,
  BRL: 5.1,
  MXN: 17.5,
  INR: 83
};

export function resolveDLocalChargeAmount(
  country: string,
  amountUsd: number
): { amount: number; currency: string } {
  const normalizedCountry = country.trim().toUpperCase();
  const currency = DLOCAL_LOCAL_CURRENCY[normalizedCountry] ?? 'USD';

  if (currency === 'USD') {
    return { amount: Number(amountUsd.toFixed(2)), currency };
  }

  const envKey = DLOCAL_FX_ENV_KEYS[currency];
  const parsedFx = envKey ? Number(process.env[envKey]) : NaN;
  const fxRate = Number.isFinite(parsedFx) && parsedFx > 0 ? parsedFx : DLOCAL_FX_DEFAULTS[currency] ?? 1;

  return {
    amount: Number((amountUsd * fxRate).toFixed(2)),
    currency
  };
}
