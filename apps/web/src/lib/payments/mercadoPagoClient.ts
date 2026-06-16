export function mercadoPagoAccessToken(): string | null {
  return process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || null;
}

export function isMercadoPagoSandbox(accessToken?: string | null): boolean {
  const token = accessToken ?? mercadoPagoAccessToken();
  return Boolean(token?.startsWith('TEST-'));
}

export function mercadoPagoCheckoutUrl(data: {
  init_point?: string;
  sandbox_init_point?: string;
}): string | undefined {
  if (isMercadoPagoSandbox()) {
    return data.sandbox_init_point ?? data.init_point;
  }
  return data.init_point ?? data.sandbox_init_point;
}

export function mercadoPagoTokenLooksInvalid(accessToken?: string | null): string | null {
  const token = accessToken ?? mercadoPagoAccessToken();
  if (!token) {
    return 'MISSING_ACCESS_TOKEN';
  }
  // Public keys are UUID-shaped; backend access tokens include account id segments.
  if (/^(TEST|APP_USR)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return 'LIKELY_PUBLIC_KEY_NOT_ACCESS_TOKEN';
  }
  return null;
}

export type MercadoPagoProbeResult = {
  ok: boolean;
  sandbox: boolean;
  userId?: number;
  canCreateCheckout: boolean;
  error?: string;
};

export async function probeMercadoPagoIntegration(): Promise<MercadoPagoProbeResult> {
  const accessToken = mercadoPagoAccessToken();
  const invalidHint = mercadoPagoTokenLooksInvalid(accessToken);
  if (!accessToken) {
    return { ok: false, sandbox: false, canCreateCheckout: false, error: 'MISSING_ACCESS_TOKEN' };
  }
  if (invalidHint) {
    return { ok: false, sandbox: isMercadoPagoSandbox(accessToken), canCreateCheckout: false, error: invalidHint };
  }

  const userResponse = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!userResponse.ok) {
    const body = await userResponse.text();
    return {
      ok: false,
      sandbox: isMercadoPagoSandbox(accessToken),
      canCreateCheckout: false,
      error: body.includes('UNAUTHORIZED') ? 'INVALID_ACCESS_TOKEN' : `USERS_ME_${userResponse.status}`
    };
  }

  const user = (await userResponse.json()) as { id?: number };
  const charge = { title: 'Sanova probe', quantity: 1, currency_id: 'ARS', unit_price: 100 };
  const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      items: [charge],
      back_urls: {
        success: 'https://www.sanovacapital.com/marketplace/carrito?status=success',
        failure: 'https://www.sanovacapital.com/marketplace/carrito?status=failed',
        pending: 'https://www.sanovacapital.com/marketplace/carrito?status=pending'
      }
    })
  });

  if (!preferenceResponse.ok) {
    return {
      ok: false,
      sandbox: isMercadoPagoSandbox(accessToken),
      userId: user.id,
      canCreateCheckout: false,
      error: `PREFERENCE_${preferenceResponse.status}`
    };
  }

  const preference = (await preferenceResponse.json()) as {
    init_point?: string;
    sandbox_init_point?: string;
  };

  return {
    ok: true,
    sandbox: isMercadoPagoSandbox(accessToken),
    userId: user.id,
    canCreateCheckout: Boolean(mercadoPagoCheckoutUrl(preference))
  };
}
