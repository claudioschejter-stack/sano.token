import { createHmac } from 'node:crypto';
import { checkoutBaseUrl } from './paymentConfig';

type DLocalPaymentInput = {
  externalId: string;
  amountUsd: number;
  country: string;
  paymentMethodId?: string;
  userEmail?: string | null;
  successUrl: string;
  backUrl: string;
  description?: string;
};

type DLocalPaymentResult = {
  provider: 'dlocal';
  providerPaymentId?: string;
  providerCheckoutUrl?: string;
  metadata: Record<string, unknown>;
};

function dlocalApiBase(): string {
  return (process.env.DLOCAL_API_BASE_URL ?? 'https://api.dlocal.com').replace(/\/$/, '');
}

function dlocalLogin(): string | null {
  return process.env.DLOCAL_API_KEY?.trim() || process.env.DLOCAL_X_LOGIN?.trim() || null;
}

function dlocalTransKey(): string | null {
  return process.env.DLOCAL_SECRET_KEY?.trim() || process.env.DLOCAL_X_TRANS_KEY?.trim() || null;
}

function signDLocalRequest(login: string, date: string, body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${login}${date}${body}`).digest('hex');
}

function mapCountryToDLocal(country: string): string {
  if (country === 'EU') {
    return process.env.DLOCAL_DEFAULT_EU_COUNTRY?.trim().toUpperCase() || 'DE';
  }
  return country.length === 2 ? country : 'AR';
}

export async function createDLocalPayment(input: DLocalPaymentInput): Promise<DLocalPaymentResult> {
  const login = dlocalLogin();
  const transKey = dlocalTransKey();
  const country = mapCountryToDLocal(input.country);

  if (!login || !transKey) {
    return {
      provider: 'dlocal',
      metadata: { configured: false, reason: 'MISSING_DLOCAL_CREDENTIALS' }
    };
  }

  const notificationUrl = `${checkoutBaseUrl()}/api/webhooks/dlocal`;
  const body = {
    amount: Number(input.amountUsd.toFixed(2)),
    currency: 'USD',
    country,
    payment_method_id: input.paymentMethodId ?? 'CARD',
    payment_method_flow: 'REDIRECT',
    payer: input.userEmail ? { email: input.userEmail } : undefined,
    order_id: input.externalId,
    notification_url: notificationUrl,
    callback_url: input.successUrl,
    description: input.description ?? `Sanova ${input.externalId}`
  };

  const bodyText = JSON.stringify(body);
  const date = new Date().toISOString();
  const signature = signDLocalRequest(login, date, bodyText, transKey);

  try {
    const response = await fetch(`${dlocalApiBase()}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Date': date,
        'X-Login': login,
        'X-Trans-Key': transKey,
        Authorization: `V2-HMAC-SHA256: ${signature}`
      },
      body: bodyText
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        provider: 'dlocal',
        metadata: { configured: true, error: text, country, paymentMethodId: input.paymentMethodId }
      };
    }

    const data = JSON.parse(text) as {
      id?: string;
      redirect_url?: string;
      status?: string;
    };

    return {
      provider: 'dlocal',
      providerPaymentId: data.id ?? input.externalId,
      providerCheckoutUrl: data.redirect_url,
      metadata: {
        configured: true,
        country,
        paymentMethodId: input.paymentMethodId,
        status: data.status,
        mode: 'api'
      }
    };
  } catch (error) {
    return {
      provider: 'dlocal',
      metadata: {
        configured: true,
        error: error instanceof Error ? error.message : 'DLOCAL_REQUEST_FAILED',
        country
      }
    };
  }
}

export function verifyDLocalWebhookSignature(input: {
  login?: string | null;
  date?: string | null;
  signature?: string | null;
  payload: string;
}): boolean {
  const secret = dlocalTransKey();
  const login = dlocalLogin();
  if (!secret || !login || !input.date || !input.signature) {
    return process.env.NODE_ENV !== 'production';
  }

  const expected = signDLocalRequest(login, input.date, input.payload, secret);
  return expected === input.signature.trim();
}

export function isDLocalPaymentPaid(status?: string | null): boolean {
  const normalized = status?.trim().toUpperCase() ?? '';
  return normalized === 'PAID' || normalized === 'AUTHORIZED' || normalized === 'APPROVED';
}
