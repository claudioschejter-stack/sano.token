import {
  macroClickApiBaseUrl,
  macroClickFrase,
  macroClickGuid,
  isMacroClickConfigured
} from './config';
import type {
  MacroClickApiResponse,
  MacroClickCaja,
  MacroClickDebinRequest,
  MacroClickLinkPago,
  MacroClickLinkPagoRequest,
  MacroClickOrder,
  MacroClickPaymentMethod,
  MacroClickQrMultiDueRequest,
  MacroClickQrRequest,
  MacroClickSession,
  MacroClickTransaction
} from './types';

let cachedSession: MacroClickSession | null = null;

async function parseJson<T>(res: Response): Promise<MacroClickApiResponse<T>> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as MacroClickApiResponse<T>) : {};
  } catch {
    return { status: false, message: text.slice(0, 300), code: res.status };
  }
}

export async function macroClickHealth(): Promise<MacroClickApiResponse> {
  const res = await fetch(`${macroClickApiBaseUrl()}/health`, { cache: 'no-store' });
  return parseJson(res);
}

export async function getMacroClickSessionToken(force = false): Promise<string> {
  if (!isMacroClickConfigured()) {
    throw new Error('MACRO_CLICK_NOT_CONFIGURED');
  }
  const now = Date.now();
  if (!force && cachedSession && cachedSession.expiresAtMs > now + 30_000) {
    return cachedSession.token;
  }

  const res = await fetch(`${macroClickApiBaseUrl()}/sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      guid: macroClickGuid(),
      frase: macroClickFrase()
    }),
    cache: 'no-store'
  });

  const body = await parseJson<{ token?: string; access_token?: string; jwt?: string; expiresIn?: number }>(
    res
  );
  if (!res.ok) {
    throw new Error(`MACRO_CLICK_SESSION_FAILED:${res.status}:${body.message ?? ''}`);
  }

  const token =
    body.data?.token ??
    body.data?.access_token ??
    body.data?.jwt ??
    (typeof (body as { token?: string }).token === 'string' ? (body as { token: string }).token : null);

  if (!token) {
    throw new Error('MACRO_CLICK_SESSION_TOKEN_MISSING');
  }

  const ttlSec = Number(body.data?.expiresIn ?? 50 * 60);
  cachedSession = {
    token,
    expiresAtMs: Date.now() + (Number.isFinite(ttlSec) ? ttlSec : 3000) * 1000
  };
  return token;
}

async function authorizedFetch<T>(
  path: string,
  init: RequestInit = {},
  retried = false
): Promise<MacroClickApiResponse<T>> {
  const token = await getMacroClickSessionToken(retried);
  const res = await fetch(`${macroClickApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    },
    cache: 'no-store'
  });

  if (res.status === 401 && !retried) {
    cachedSession = null;
    return authorizedFetch<T>(path, init, true);
  }

  const body = await parseJson<T>(res);
  if (!res.ok) {
    throw new Error(`MACRO_CLICK_API_${res.status}:${body.message ?? path}`);
  }
  return body;
}

export async function listMacroClickTransactions(query?: Record<string, string>) {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  return authorizedFetch<MacroClickTransaction[]>(`/transactions${qs}`);
}

export async function getMacroClickTransaction(commerceTransactionId: string) {
  return authorizedFetch<MacroClickTransaction>(
    `/transaction/${encodeURIComponent(commerceTransactionId)}`
  );
}

export async function searchMacroClickTransaction(params: { orderId?: string; internalId?: string }) {
  const qs = new URLSearchParams();
  if (params.orderId) qs.set('orderId', params.orderId);
  if (params.internalId) qs.set('internalId', params.internalId);
  return authorizedFetch<MacroClickTransaction>(`/transaction/search?${qs.toString()}`);
}

export async function listMacroClickPaymentMethods() {
  return authorizedFetch<MacroClickPaymentMethod[]>('/payment-methods');
}

export async function createMacroClickCaja(input: { codigo: string; nombre: string }) {
  return authorizedFetch<MacroClickCaja>('/caja', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function getMacroClickCaja(codigoOrId: string) {
  return authorizedFetch<MacroClickCaja>(`/caja/${encodeURIComponent(codigoOrId)}`);
}

export async function deleteMacroClickCaja(codigoOrId: string) {
  return authorizedFetch(`/caja/${encodeURIComponent(codigoOrId)}`, { method: 'DELETE' });
}

export async function createMacroClickOrder(codigoCaja: string, body: Record<string, unknown>) {
  return authorizedFetch<MacroClickOrder>(`/order/${encodeURIComponent(codigoCaja)}`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function getMacroClickOrder(codigoCaja: string) {
  return authorizedFetch<MacroClickOrder>(`/order/${encodeURIComponent(codigoCaja)}`);
}

export async function deleteMacroClickOrder() {
  return authorizedFetch('/order', { method: 'DELETE' });
}

export async function createMacroClickRefund(body: {
  TransaccionComercioId?: string;
  TransaccionPlataformaId?: string | number;
  Monto?: number | string;
}) {
  return authorizedFetch('/refund', { method: 'POST', body: JSON.stringify(body) });
}

export async function createMacroClickDebin(input: MacroClickDebinRequest) {
  return authorizedFetch('/debin', {
    method: 'POST',
    body: JSON.stringify({
      cuit: input.cuit,
      cbu: input.cbuOrAlias,
      alias: input.cbuOrAlias,
      monto: input.amountCents,
      transaccionComercioId: input.commerceTransactionId,
      concepto: input.concept
    })
  });
}

export async function createMacroClickCardToken(body: Record<string, unknown>) {
  return authorizedFetch('/tokens', { method: 'POST', body: JSON.stringify(body) });
}

export async function createMacroClickCardPayment(body: Record<string, unknown>) {
  return authorizedFetch('/payment', { method: 'POST', body: JSON.stringify(body) });
}

export async function createMacroClickPaymentLink(input: MacroClickLinkPagoRequest) {
  return authorizedFetch<MacroClickLinkPago>('/link-pago', {
    method: 'POST',
    body: JSON.stringify({
      monto: input.amountCents,
      transaccionComercioId: input.commerceTransactionId,
      descripcion: input.description,
      notification_url: input.notificationUrl,
      url_success: input.successUrl,
      url_cancel: input.cancelUrl,
      moneda: input.currency ?? 'ARS',
      informacion: input.additionalInfo ? JSON.stringify(input.additionalInfo) : undefined
    })
  });
}

export async function createMacroClickQr(input: MacroClickQrRequest) {
  return authorizedFetch('/qr', {
    method: 'POST',
    body: JSON.stringify({
      monto: input.amountCents,
      transaccionComercioId: input.commerceTransactionId,
      descripcion: input.description,
      notification_url: input.notificationUrl
    })
  });
}

export async function createMacroClickQrMultiDue(input: MacroClickQrMultiDueRequest) {
  return authorizedFetch('/qr-vencimientos-multiples', {
    method: 'POST',
    body: JSON.stringify({
      transaccionComercioId: input.commerceTransactionId,
      descripcion: input.description,
      notification_url: input.notificationUrl,
      vencimientos: input.dues.map((d) => ({
        fecha: d.dueDate,
        monto: d.amountCents
      }))
    })
  });
}

export async function listMacroClickLiquidaciones(fecha: string) {
  return authorizedFetch(`/liquidaciones?fecha=${encodeURIComponent(fecha)}`);
}

export async function getMacroClickLiquidacionDetalle(fecha: string) {
  return authorizedFetch(`/liquidaciones/detalle?fecha=${encodeURIComponent(fecha)}`);
}
