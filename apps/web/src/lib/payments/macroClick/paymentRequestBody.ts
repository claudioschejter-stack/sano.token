import type { MacroClickLinkPagoRequest, MacroClickQrRequest, MacroClickQrMultiDueRequest } from './types';

/**
 * El cuerpo que la API de Click de Pago acepta para links y QR.
 *
 * Lo que el repo mandaba —`monto`, `transaccionComercioId`, `descripcion` planos—
 * la API lo rechaza de entrada con `Solicitud inválida: payment_request es
 * requerido`. O sea que el cobro de alquileres por link nunca pudo haber
 * funcionado: falla antes de llegar a Macro.
 *
 * La forma real se descubrió probando contra el sandbox, campo por campo, porque
 * el manual no está en el repo. Cada error nombraba el siguiente requisito:
 *
 *   {}                                    -> "payment_request es requerido"
 *   { payment_request: { monto } }        -> "El monto es obligatorio"
 *   { payment_request: { total } }        -> "La fecha de expiración es obligatoria"
 *   { payment_request: { total, due_date } } -> "external_reference es obligatorio"
 *   ... con due_date a 7 días           -> "La fecha no puede ser mayor a 72 horas"
 *
 * Así que: `total` y no `monto`, `due_date` con tope de 72 horas, y
 * `external_reference` donde antes iba `transaccionComercioId`.
 */

/** La API rechaza cualquier vencimiento más lejano que esto. */
export const MACRO_CLICK_MAX_DUE_HOURS = 72;
/** Margen para no quedar al filo del tope por diferencia de reloj. */
const DEFAULT_DUE_HOURS = 48;

export type MacroClickPaymentRequestBody = {
  payment_request: Record<string, unknown>;
};

/** `YYYY-MM-DD`, que es el formato que acepta `due_date`. */
export function macroClickDueDate(input?: { dueDate?: string | null; nowMs?: number }): string {
  const now = input?.nowMs ?? Date.now();
  const explicit = input?.dueDate?.trim();

  if (explicit) {
    const parsed = Date.parse(explicit.length === 10 ? `${explicit}T12:00:00Z` : explicit);
    const maxMs = now + MACRO_CLICK_MAX_DUE_HOURS * 3_600_000;
    /**
     * Recortar en vez de fallar. Un vencimiento demasiado lejano es un pedido
     * razonable que la API no soporta, y rechazar el cobro entero por eso deja al
     * inquilino sin forma de pagar.
     */
    if (Number.isFinite(parsed) && parsed <= maxMs) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
    return new Date(maxMs).toISOString().slice(0, 10);
  }

  return new Date(now + DEFAULT_DUE_HOURS * 3_600_000).toISOString().slice(0, 10);
}

function backUrls(successUrl?: string, cancelUrl?: string): Record<string, string> | undefined {
  if (!successUrl && !cancelUrl) return undefined;
  const urls: Record<string, string> = {};
  if (successUrl) urls.success = successUrl;
  if (cancelUrl) {
    urls.failure = cancelUrl;
    urls.pending = cancelUrl;
  }
  return urls;
}

function withoutEmpty(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

export function buildMacroClickPaymentLinkBody(
  input: MacroClickLinkPagoRequest & { dueDate?: string | null; nowMs?: number }
): MacroClickPaymentRequestBody {
  return {
    payment_request: withoutEmpty({
      total: input.amountCents,
      due_date: macroClickDueDate({ dueDate: input.dueDate, nowMs: input.nowMs }),
      external_reference: input.commerceTransactionId,
      description: input.description,
      notification_url: input.notificationUrl,
      back_urls: backUrls(input.successUrl, input.cancelUrl),
      currency: input.currency,
      informacion: input.additionalInfo ? JSON.stringify(input.additionalInfo) : undefined
    })
  };
}

export function buildMacroClickQrBody(
  input: MacroClickQrRequest & { dueDate?: string | null; nowMs?: number }
): MacroClickPaymentRequestBody {
  return {
    payment_request: withoutEmpty({
      total: input.amountCents,
      due_date: macroClickDueDate({ dueDate: input.dueDate, nowMs: input.nowMs }),
      external_reference: input.commerceTransactionId,
      description: input.description,
      notification_url: input.notificationUrl
    })
  };
}

export function buildMacroClickQrMultiDueBody(
  input: MacroClickQrMultiDueRequest & { nowMs?: number }
): MacroClickPaymentRequestBody {
  const [first, ...rest] = input.dues;
  return {
    payment_request: withoutEmpty({
      total: first?.amountCents,
      due_date: macroClickDueDate({ dueDate: first?.dueDate, nowMs: input.nowMs }),
      external_reference: input.commerceTransactionId,
      description: input.description,
      notification_url: input.notificationUrl,
      /**
       * Los vencimientos por mora van como filas adicionales. La primera se
       * duplica arriba en `total`/`due_date` porque la API pide esos dos sí o sí,
       * también cuando hay varios.
       */
      vencimientos: rest.length
        ? rest.map((due) => ({
            fecha: due.dueDate,
            monto: due.amountCents
          }))
        : undefined
    })
  };
}
