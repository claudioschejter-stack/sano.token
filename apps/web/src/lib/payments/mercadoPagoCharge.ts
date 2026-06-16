const MERCADOPAGO_LOCAL_CURRENCY: Record<string, string> = {
  AR: 'ARS'
};

const MERCADOPAGO_FX_ENV_KEYS: Record<string, string> = {
  ARS: 'MERCADOPAGO_FX_ARS'
};

const MERCADOPAGO_FX_DEFAULTS: Record<string, number> = {
  ARS: 1050
};

function mercadoPagoDefaultCountry(): string {
  return process.env.MERCADOPAGO_DEFAULT_COUNTRY?.trim().toUpperCase() || 'AR';
}

export function resolveMercadoPagoChargeAmount(
  amountUsd: number,
  country?: string
): { amount: number; currency: string } {
  const normalizedCountry = (country ?? mercadoPagoDefaultCountry()).trim().toUpperCase();
  const currency = MERCADOPAGO_LOCAL_CURRENCY[normalizedCountry] ?? 'USD';

  if (currency === 'USD') {
    return { amount: Number(amountUsd.toFixed(2)), currency };
  }

  const envKey = MERCADOPAGO_FX_ENV_KEYS[currency];
  const parsedFx = envKey ? Number(process.env[envKey]) : NaN;
  const fallbackFx = Number(process.env.DLOCAL_FX_ARS);
  const defaultFx =
    Number.isFinite(fallbackFx) && fallbackFx > 0
      ? fallbackFx
      : MERCADOPAGO_FX_DEFAULTS[currency] ?? 1;
  const fxRate = Number.isFinite(parsedFx) && parsedFx > 0 ? parsedFx : defaultFx;

  return {
    amount: Number((amountUsd * fxRate).toFixed(2)),
    currency
  };
}
