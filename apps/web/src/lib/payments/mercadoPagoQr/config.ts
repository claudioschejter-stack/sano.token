import { mercadoPagoAccessToken, mercadoPagoWebhookSecret } from '../mercadoPagoClient';

export const MP_ORDERS_BASE_URL = 'https://api.mercadopago.com/v1/orders';

export function mercadoPagoQrStoreId(): string | null {
  return process.env.MP_STORE_ID?.trim() || process.env.MERCADOPAGO_STORE_ID?.trim() || null;
}

export function mercadoPagoQrExternalPosId(): string | null {
  return (
    process.env.MP_EXTERNAL_POS_ID?.trim() ||
    process.env.MERCADOPAGO_EXTERNAL_POS_ID?.trim() ||
    null
  );
}

export function mercadoPagoQrDefaultExpiration(): string {
  return process.env.MP_QR_EXPIRATION_TIME?.trim() || 'PT16M';
}

export function mercadoPagoQrDefaultMode(): 'static' | 'dynamic' | 'hybrid' {
  const mode = process.env.MP_QR_DEFAULT_MODE?.trim().toLowerCase();
  if (mode === 'static' || mode === 'dynamic' || mode === 'hybrid') {
    return mode;
  }
  return 'dynamic';
}

export function isMercadoPagoQrConfigured(): boolean {
  return Boolean(mercadoPagoAccessToken() && mercadoPagoQrExternalPosId());
}

export function assertMercadoPagoQrConfigured(): void {
  if (!mercadoPagoAccessToken()) {
    throw new Error('MP_ACCESS_TOKEN_NOT_CONFIGURED');
  }
  if (!mercadoPagoQrExternalPosId()) {
    throw new Error('MP_EXTERNAL_POS_ID_NOT_CONFIGURED');
  }
}

export function mercadoPagoQrWebhookSecret(): string | null {
  return mercadoPagoWebhookSecret();
}
