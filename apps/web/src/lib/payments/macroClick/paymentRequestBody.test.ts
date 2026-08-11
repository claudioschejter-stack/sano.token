import { describe, expect, it } from 'vitest';
import {
  MACRO_CLICK_MAX_DUE_HOURS,
  buildMacroClickPaymentLinkBody,
  buildMacroClickQrBody,
  buildMacroClickQrMultiDueBody,
  macroClickDueDate
} from './paymentRequestBody';

const NOW = Date.parse('2026-08-10T12:00:00.000Z');
const HOUR = 3_600_000;

describe('macroClickDueDate', () => {
  it('usa 48 horas cuando no se pide una fecha', () => {
    expect(macroClickDueDate({ nowMs: NOW })).toBe('2026-08-12');
  });

  it('respeta una fecha pedida dentro del tope', () => {
    expect(macroClickDueDate({ dueDate: '2026-08-11', nowMs: NOW })).toBe('2026-08-11');
  });

  /**
   * La API contesta "La fecha no puede ser mayor a 72 horas". Recortar en vez de
   * fallar: un vencimiento lejano es un pedido razonable que la API no soporta, y
   * rechazar el cobro entero por eso deja al inquilino sin forma de pagar.
   */
  it('recorta una fecha más lejana que el tope de la API', () => {
    const clamped = macroClickDueDate({ dueDate: '2026-09-30', nowMs: NOW });
    expect(clamped).toBe('2026-08-13');
    expect(Date.parse(`${clamped}T00:00:00Z`)).toBeLessThanOrEqual(NOW + MACRO_CLICK_MAX_DUE_HOURS * HOUR);
  });

  it('recorta también una fecha ilegible', () => {
    expect(macroClickDueDate({ dueDate: 'el mes que viene', nowMs: NOW })).toBe('2026-08-13');
  });
});

describe('buildMacroClickPaymentLinkBody', () => {
  const input = {
    amountCents: 2_100_000,
    commerceTransactionId: 'rent:proj-1:2026-08',
    description: 'Alquiler agosto',
    notificationUrl: 'https://sanovacapital.com/api/webhooks/macro-click',
    successUrl: 'https://sanovacapital.com/ok',
    cancelUrl: 'https://sanovacapital.com/no',
    currency: 'ARS' as const,
    nowMs: NOW
  };

  /**
   * Los tres nombres que la API exige, y que el cuerpo anterior no tenía: manda
   * `total` y no `monto`, `external_reference` y no `transaccionComercioId`, y
   * `due_date` obligatorio.
   */
  it('manda los campos con los nombres que la API exige', () => {
    const body = buildMacroClickPaymentLinkBody(input);
    const request = body.payment_request;

    expect(request.total).toBe(2_100_000);
    expect(request.external_reference).toBe('rent:proj-1:2026-08');
    expect(request.due_date).toBe('2026-08-12');
    expect(request.monto).toBeUndefined();
    expect(request.transaccionComercioId).toBeUndefined();
  });

  it('envuelve todo en payment_request, que es lo que la API pide primero', () => {
    const body = buildMacroClickPaymentLinkBody(input);
    expect(Object.keys(body)).toEqual(['payment_request']);
  });

  it('traduce las URLs de retorno a back_urls', () => {
    const request = buildMacroClickPaymentLinkBody(input).payment_request;
    expect(request.back_urls).toEqual({
      success: 'https://sanovacapital.com/ok',
      failure: 'https://sanovacapital.com/no',
      pending: 'https://sanovacapital.com/no'
    });
  });

  it('omite lo que no se pasó en vez de mandar undefined', () => {
    const request = buildMacroClickPaymentLinkBody({
      amountCents: 1000,
      commerceTransactionId: 'ref',
      nowMs: NOW
    }).payment_request;

    expect('description' in request).toBe(false);
    expect('back_urls' in request).toBe(false);
    expect('notification_url' in request).toBe(false);
  });

  it('serializa la información adicional', () => {
    const request = buildMacroClickPaymentLinkBody({
      ...input,
      additionalInfo: { projectId: 'proj-1', periodKey: '2026-08' }
    }).payment_request;

    expect(JSON.parse(String(request.informacion))).toEqual({
      projectId: 'proj-1',
      periodKey: '2026-08'
    });
  });
});

describe('buildMacroClickQrBody', () => {
  it('usa la misma forma que el link', () => {
    const request = buildMacroClickQrBody({
      amountCents: 50_000,
      commerceTransactionId: 'qr-ref',
      description: 'Cobro QR',
      notificationUrl: 'https://sanovacapital.com/api/webhooks/macro-click',
      nowMs: NOW
    }).payment_request;

    expect(request.total).toBe(50_000);
    expect(request.external_reference).toBe('qr-ref');
    expect(request.due_date).toBe('2026-08-12');
  });
});

describe('buildMacroClickQrMultiDueBody', () => {
  it('sube el primer vencimiento a total y due_date, que son obligatorios', () => {
    const request = buildMacroClickQrMultiDueBody({
      commerceTransactionId: 'multi-ref',
      description: 'Alquiler con mora',
      dues: [
        { dueDate: '2026-08-11', amountCents: 100_000 },
        { dueDate: '2026-08-12', amountCents: 110_000 }
      ],
      nowMs: NOW
    }).payment_request;

    expect(request.total).toBe(100_000);
    expect(request.due_date).toBe('2026-08-11');
    expect(request.vencimientos).toEqual([{ fecha: '2026-08-12', monto: 110_000 }]);
  });

  it('no manda vencimientos cuando hay uno solo', () => {
    const request = buildMacroClickQrMultiDueBody({
      commerceTransactionId: 'multi-ref',
      dues: [{ dueDate: '2026-08-11', amountCents: 100_000 }],
      nowMs: NOW
    }).payment_request;

    expect('vencimientos' in request).toBe(false);
  });
});
