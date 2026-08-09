import type { MacroClickWebhookPayload } from './types';

/** Macro may send major units or cents; mirror rent settlement heuristics. */
export function parseMacroMontoToMajorUnits(monto: string | number | undefined): number | null {
  if (typeof monto === 'number' && Number.isFinite(monto)) {
    return monto > 100_000 ? monto / 100 : monto;
  }
  if (typeof monto !== 'string' || !monto.trim()) return null;
  const normalized = monto.trim().replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  if (!monto.includes(',') && !monto.includes('.') && Number.isInteger(value) && value >= 1000) {
    return value / 100;
  }
  return value;
}

function parseAdditionalInfo(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* plain string from Macro */
  }
  return null;
}

export type MacroClickWebhookEconomics = {
  currency: 'ARS' | 'USD' | null;
  localAmount: number | null;
  amountUsd: number | null;
};

/**
 * Recover what Macro charged and the checkout USD figure from the webhook body.
 * Checkout stores `{ currency, localAmount, amountUsd }` in Informacion / InformacionAdicional.
 */
export function parseMacroClickWebhookEconomics(
  payload: MacroClickWebhookPayload | Record<string, unknown>
): MacroClickWebhookEconomics {
  const additional =
    parseAdditionalInfo(payload.InformacionAdicional) ??
    parseAdditionalInfo((payload as Record<string, unknown>).Informacion) ??
    parseAdditionalInfo((payload as Record<string, unknown>).informacion);

  const currencyRaw =
    typeof additional?.currency === 'string'
      ? additional.currency.trim().toUpperCase()
      : typeof (payload as Record<string, unknown>).fiatCurrency === 'string'
        ? String((payload as Record<string, unknown>).fiatCurrency).trim().toUpperCase()
        : null;
  const currency = currencyRaw === 'ARS' || currencyRaw === 'USD' ? currencyRaw : null;

  const localFromInfo =
    typeof additional?.localAmount === 'number' && Number.isFinite(additional.localAmount)
      ? additional.localAmount
      : null;
  const montoRaw =
    (payload as MacroClickWebhookPayload).Monto ?? (payload as Record<string, unknown>).monto;
  const localFromMonto = parseMacroMontoToMajorUnits(
    typeof montoRaw === 'string' || typeof montoRaw === 'number' ? montoRaw : undefined
  );
  const localAmount = localFromInfo ?? localFromMonto;

  const amountUsdFromInfo =
    typeof additional?.amountUsd === 'number' && Number.isFinite(additional.amountUsd)
      ? additional.amountUsd
      : null;
  const amountUsdFromPayload =
    typeof (payload as Record<string, unknown>).amountUsd === 'number' &&
    Number.isFinite((payload as Record<string, unknown>).amountUsd as number)
      ? ((payload as Record<string, unknown>).amountUsd as number)
      : null;

  let amountUsd = amountUsdFromInfo ?? amountUsdFromPayload;
  if (amountUsd == null && currency === 'USD' && localAmount != null) {
    amountUsd = localAmount;
  }

  return { currency, localAmount, amountUsd };
}
