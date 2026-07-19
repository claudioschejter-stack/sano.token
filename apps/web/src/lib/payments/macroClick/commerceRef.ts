import type { MacroClickCommerceRef } from './types';

const PREFIX = 'snv';

/** Encode Sanova payment context into Macro TransaccionComercioId (alphanumeric + _). */
export function encodeMacroClickCommerceRef(ref: MacroClickCommerceRef): string {
  if (ref.kind === 'deposit') {
    return `${PREFIX}_dep_${ref.depositId}`.slice(0, 64);
  }
  if (ref.kind === 'cart') {
    return `${PREFIX}_cart_${ref.batchId}`.slice(0, 64);
  }
  const tenant = ref.tenantKey ? `_${sanitize(ref.tenantKey)}` : '';
  return `${PREFIX}_rent_${sanitize(ref.projectId)}_${sanitize(ref.periodKey)}${tenant}_${ref.currency}`.slice(
    0,
    64
  );
}

export function decodeMacroClickCommerceRef(raw: string | null | undefined): MacroClickCommerceRef | null {
  const value = raw?.trim();
  if (!value) return null;

  if (value.startsWith(`${PREFIX}_dep_`)) {
    return { kind: 'deposit', depositId: value.slice(`${PREFIX}_dep_`.length) };
  }
  if (value.startsWith(`${PREFIX}_cart_`)) {
    return { kind: 'cart', batchId: value.slice(`${PREFIX}_cart_`.length) };
  }
  if (value.startsWith(`${PREFIX}_rent_`)) {
    const rest = value.slice(`${PREFIX}_rent_`.length);
    const parts = rest.split('_').filter(Boolean);
    if (parts.length < 3) return null;
    const currency = parts[parts.length - 1]?.toUpperCase();
    if (currency !== 'ARS' && currency !== 'USD') return null;
    const projectId = parts[0];
    const periodKey = parts[1];
    const tenantKey = parts.length > 3 ? parts.slice(2, -1).join('_') : undefined;
    if (!projectId || !periodKey) return null;
    return {
      kind: 'rent',
      projectId,
      periodKey,
      currency,
      ...(tenantKey ? { tenantKey } : {})
    };
  }

  return null;
}

/** Resolve webhook external reference for deposit/cart dispatch (legacy or encoded). */
export function resolveMacroClickPaymentReference(commerceId: string | null | undefined): string | null {
  const decoded = decodeMacroClickCommerceRef(commerceId);
  if (!decoded) return commerceId?.trim() || null;
  if (decoded.kind === 'deposit') return decoded.depositId;
  if (decoded.kind === 'cart') return decoded.batchId;
  return null;
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36);
}
