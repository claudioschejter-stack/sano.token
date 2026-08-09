import { creditAndDistributeOperatingRent } from '../../yield/creditAndDistributeRent';
import { parseMacroMontoToMajorUnits } from './parseWebhookEconomics';
import type { MacroClickCommerceRef, MacroClickWebhookPayload } from './types';
import { MACRO_CLICK_ESTADO } from './types';

export function isMacroClickPaymentSuccessful(payload: MacroClickWebhookPayload): boolean {
  const estadoId = Number(payload.EstadoId);
  if (estadoId === MACRO_CLICK_ESTADO.REALIZADA) return true;
  const estado = String(payload.Estado ?? '').toUpperCase();
  return estado === 'REALIZADA' || estado.includes('REALIZAD') || estado === 'APROBADA';
}

export function isMacroClickPaymentFailed(payload: MacroClickWebhookPayload): boolean {
  const estadoId = Number(payload.EstadoId);
  const failedIds: number[] = [
    MACRO_CLICK_ESTADO.RECHAZADA,
    MACRO_CLICK_ESTADO.EXPIRADA,
    MACRO_CLICK_ESTADO.CANCELADA,
    MACRO_CLICK_ESTADO.VENCIDA
  ];
  if (Number.isFinite(estadoId) && failedIds.includes(estadoId)) {
    return true;
  }
  const estado = String(payload.Estado ?? '').toUpperCase();
  return (
    estado.includes('RECHAZ') ||
    estado.includes('CANCEL') ||
    estado.includes('EXPIR') ||
    estado.includes('VENCID')
  );
}

/**
 * Tenant rent paid via Macro (ARS or USD) → operating credit + distribute to RWA holders.
 * ARS with USDC-preference holders queues FX→USDC then Privy transfer via existing yield pipeline.
 * USD credits distribute immediately (FIAT ledger and/or Privy USDC per holder preference).
 */
export async function settleMacroClickRentPayment(input: {
  ref: Extract<MacroClickCommerceRef, { kind: 'rent' }>;
  payload: MacroClickWebhookPayload;
}) {
  const amount = parseMacroMontoToMajorUnits(input.payload.Monto);
  if (!amount || amount <= 0) {
    return { ok: false as const, error: 'INVALID_RENT_AMOUNT' };
  }

  const platformId = String(
    input.payload.TransaccionPlataformaId ?? input.payload.TransaccionComercioId ?? 'unknown'
  );
  const idempotencyKey = `macro-rent:${input.ref.projectId}:${input.ref.periodKey}:${input.ref.currency}:${platformId}`;

  const result = await creditAndDistributeOperatingRent({
    projectId: input.ref.projectId,
    amount,
    currency: input.ref.currency,
    idempotencyKey,
    autoConvertIfNeeded: true,
    metadata: {
      provider: 'macro_click',
      periodKey: input.ref.periodKey,
      tenantKey: input.ref.tenantKey ?? null,
      TransaccionPlataformaId: input.payload.TransaccionPlataformaId ?? null,
      TransaccionComercioId: input.payload.TransaccionComercioId ?? null,
      MedioPago: input.payload.MedioPago ?? null,
      Estado: input.payload.Estado ?? null,
      EstadoId: input.payload.EstadoId ?? null,
      flow: 'macro_click_rent'
    }
  });

  return { ok: true as const, result };
}
