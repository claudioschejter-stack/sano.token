import { checkoutBaseUrl } from './paymentConfig';
import { resolveMercadoPagoChargeAmount } from './mercadoPagoCharge';
import {
  isMercadoPagoSandbox,
  mercadoPagoAccessToken,
  mercadoPagoTokenLooksInvalid
} from './mercadoPagoClient';

export const MERCADOPAGO_WALLET_OPTION_ID = 'mercadopago_wallet';

export type MercadoPagoEmbeddedSession = {
  embedded: true;
  preferenceId: string;
  amount: number;
  currency: string;
  publicKey: string;
  sandbox: boolean;
  walletOnly: boolean;
};

export type MercadoPagoEmbeddedProbeResult = {
  ok: boolean;
  publicKeyConfigured: boolean;
  embeddedEnabled: boolean;
  walletOnly: boolean;
  sandbox: boolean;
  canCreatePreference: boolean;
  supportsAccountMoney: boolean;
  error?: string;
};

export function mercadoPagoPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || null;
}

export function isMercadoPagoEmbeddedEnabled(): boolean {
  return process.env.MERCADOPAGO_EMBEDDED_CHECKOUT !== 'false';
}

export function isMercadoPagoWalletOnly(): boolean {
  return process.env.MERCADOPAGO_WALLET_ONLY === 'true';
}

export function isMercadoPagoWalletOption(paymentOptionId?: string | null): boolean {
  return paymentOptionId === MERCADOPAGO_WALLET_OPTION_ID;
}

export function isMercadoPagoEmbeddedConfigured(): boolean {
  return Boolean(
    mercadoPagoAccessToken() &&
      mercadoPagoPublicKey() &&
      isMercadoPagoEmbeddedEnabled() &&
      !mercadoPagoTokenLooksInvalid()
  );
}

export function isMercadoPagoEmbeddedResult(metadata: unknown): metadata is MercadoPagoEmbeddedSession {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  const row = metadata as Record<string, unknown>;
  return row.embedded === true && typeof row.preferenceId === 'string' && typeof row.publicKey === 'string';
}

function mercadoPagoNotificationUrl(): string {
  return `${checkoutBaseUrl()}/api/webhooks/mercadopago`;
}

function walletPaymentMethodExclusions() {
  if (!isMercadoPagoWalletOnly()) {
    return undefined;
  }
  return {
    excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }],
    default_payment_method_id: 'account_money'
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function embeddedMisconfigured(): { error: string; sandbox: boolean } | null {
  const accessToken = mercadoPagoAccessToken();
  if (!accessToken) {
    return { error: 'MISSING_ACCESS_TOKEN', sandbox: false };
  }
  const tokenError = mercadoPagoTokenLooksInvalid(accessToken);
  if (tokenError) {
    return { error: tokenError, sandbox: isMercadoPagoSandbox(accessToken) };
  }
  if (!mercadoPagoPublicKey()) {
    return { error: 'MISSING_PUBLIC_KEY', sandbox: isMercadoPagoSandbox(accessToken) };
  }
  if (!isMercadoPagoEmbeddedEnabled()) {
    return { error: 'EMBEDDED_DISABLED', sandbox: isMercadoPagoSandbox(accessToken) };
  }
  return null;
}

export async function createMercadoPagoEmbeddedPreference(input: {
  externalReference: string;
  amountUsd: number;
  title: string;
  country?: string;
  metadata?: Record<string, unknown>;
}): Promise<
  | { ok: true; session: MercadoPagoEmbeddedSession }
  | { ok: false; error: string; sandbox: boolean }
> {
  const misconfigured = embeddedMisconfigured();
  if (misconfigured) {
    return { ok: false as const, ...misconfigured };
  }

  const accessToken = mercadoPagoAccessToken()!;
  const charge = resolveMercadoPagoChargeAmount(input.amountUsd, input.country);
  const paymentMethods = walletPaymentMethodExclusions();

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      external_reference: input.externalReference,
      items: [
        {
          title: input.title,
          quantity: 1,
          currency_id: charge.currency,
          unit_price: charge.amount
        }
      ],
      purpose: 'wallet_purchase',
      notification_url: mercadoPagoNotificationUrl(),
      ...(paymentMethods ? { payment_methods: paymentMethods } : {}),
      metadata: {
        embedded: true,
        ...input.metadata
      }
    })
  });

  if (!response.ok) {
    return {
      ok: false as const,
      error: `PREFERENCE_${response.status}`,
      sandbox: isMercadoPagoSandbox(accessToken)
    };
  }

  const data = await parseJson<{ id?: string }>(response);
  if (!data.id) {
    return {
      ok: false as const,
      error: 'PREFERENCE_MISSING_ID',
      sandbox: isMercadoPagoSandbox(accessToken)
    };
  }

  return {
    ok: true as const,
    session: {
      embedded: true,
      preferenceId: data.id,
      amount: charge.amount,
      currency: charge.currency,
      publicKey: mercadoPagoPublicKey()!,
      sandbox: isMercadoPagoSandbox(accessToken),
      walletOnly: isMercadoPagoWalletOnly()
    }
  };
}

export async function processMercadoPagoEmbeddedPayment(input: {
  formData: Record<string, unknown>;
  externalReference: string;
  amountUsd: number;
  payerEmail: string;
  country?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<
  | {
      ok: true;
      paymentId: string;
      status: string;
      approved: boolean;
      pending: boolean;
    }
  | { ok: false; error: string; details?: string }
> {
  const misconfigured = embeddedMisconfigured();
  if (misconfigured) {
    return { ok: false as const, error: misconfigured.error };
  }

  const accessToken = mercadoPagoAccessToken()!;
  const charge = resolveMercadoPagoChargeAmount(input.amountUsd, input.country);
  const token = typeof input.formData.token === 'string' ? input.formData.token : null;
  const paymentMethodId =
    typeof input.formData.payment_method_id === 'string' ? input.formData.payment_method_id : 'account_money';
  const installments =
    typeof input.formData.installments === 'number'
      ? input.formData.installments
      : Number(input.formData.installments) || 1;

  if (!token) {
    return { ok: false as const, error: 'MISSING_PAYMENT_TOKEN' };
  }

  const payer =
    input.formData.payer && typeof input.formData.payer === 'object'
      ? (input.formData.payer as Record<string, unknown>)
      : {};

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': input.idempotencyKey
    },
    body: JSON.stringify({
      token,
      transaction_amount: charge.amount,
      payment_method_id: paymentMethodId,
      installments,
      payer: {
        email: typeof payer.email === 'string' ? payer.email : input.payerEmail,
        identification:
          payer.identification && typeof payer.identification === 'object'
            ? payer.identification
            : undefined
      },
      external_reference: input.externalReference,
      notification_url: mercadoPagoNotificationUrl(),
      metadata: {
        embedded: true,
        ...input.metadata
      }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    return { ok: false as const, error: `PAYMENT_${response.status}`, details };
  }

  const payment = await parseJson<{ id?: number | string; status?: string }>(response);
  const status = payment.status ?? 'unknown';
  const approved = status === 'approved';
  const pending = ['pending', 'in_process', 'authorized'].includes(status);

  return {
    ok: true as const,
    paymentId: String(payment.id ?? ''),
    status,
    approved,
    pending
  };
}

export async function probeMercadoPagoEmbeddedWallet(): Promise<MercadoPagoEmbeddedProbeResult> {
  const publicKeyConfigured = Boolean(mercadoPagoPublicKey());
  const embeddedEnabled = isMercadoPagoEmbeddedEnabled();
  const walletOnly = isMercadoPagoWalletOnly();
  const accessToken = mercadoPagoAccessToken();
  const sandbox = isMercadoPagoSandbox(accessToken);

  if (!isMercadoPagoEmbeddedConfigured()) {
    return {
      ok: false,
      publicKeyConfigured,
      embeddedEnabled,
      walletOnly,
      sandbox,
      canCreatePreference: false,
      supportsAccountMoney: false,
      error: embeddedMisconfigured()?.error ?? 'NOT_CONFIGURED'
    };
  }

  const preference = await createMercadoPagoEmbeddedPreference({
    externalReference: `probe-${Date.now()}`,
    amountUsd: 1,
    title: 'Sanova embedded probe',
    metadata: { probe: true }
  });

  if (preference.ok === false) {
    return {
      ok: false,
      publicKeyConfigured,
      embeddedEnabled,
      walletOnly,
      sandbox,
      canCreatePreference: false,
      supportsAccountMoney: false,
      error: preference.error
    };
  }

  return {
    ok: true,
    publicKeyConfigured,
    embeddedEnabled,
    walletOnly,
    sandbox,
    canCreatePreference: true,
    supportsAccountMoney: true
  };
}
