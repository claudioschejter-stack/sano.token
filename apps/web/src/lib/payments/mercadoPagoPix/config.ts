/**
 * Pix (Brazil) requires a Mercado Pago Brasil account — the Argentine access token
 * cannot charge in BRL. Falls back to the shared token if a BR-specific one isn't set,
 * for accounts that already operate multi-country.
 */
export function mercadoPagoPixAccessToken(): string | null {
  return (
    process.env.MERCADOPAGO_BR_ACCESS_TOKEN?.trim() ||
    process.env.MP_BR_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    process.env.MP_ACCESS_TOKEN?.trim() ||
    null
  );
}

export function isMercadoPagoPixConfigured(): boolean {
  return Boolean(mercadoPagoPixAccessToken());
}

export function assertMercadoPagoPixConfigured(): void {
  if (!mercadoPagoPixAccessToken()) {
    throw new Error('MERCADOPAGO_BR_NOT_CONFIGURED');
  }
}

export function mercadoPagoPixDefaultExpirationMinutes(): number {
  const raw = Number(process.env.MP_PIX_EXPIRATION_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}
