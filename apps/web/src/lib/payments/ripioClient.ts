import { createHmac, timingSafeEqual } from 'node:crypto';
import { isProductionRuntime } from '../runtime/environment';
import type { StablecoinNetworkId } from './stablecoinNetworks';

type RipioTokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: RipioTokenCache | null = null;

export function ripioConfigured(): boolean {
  return Boolean(process.env.RIPIO_CLIENT_ID?.trim() && process.env.RIPIO_CLIENT_SECRET?.trim());
}

export function ripioApiBaseUrl(): string {
  const configured = process.env.RIPIO_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return ripioSandbox() ? 'https://skala-sandbox.ripio.com' : 'https://skala.ripio.com';
}

export function ripioSandbox(): boolean {
  const env = process.env.RIPIO_ENV?.trim().toUpperCase();
  if (env === 'SANDBOX') return true;
  if (env === 'PRODUCTION') return false;
  return ripioApiBaseUrl().includes('sandbox');
}

export function ripioPaymentMethodType(rail?: string | null): string {
  const railNormalized = rail?.trim().toLowerCase();
  if (!railNormalized) {
    return process.env.RIPIO_DEFAULT_PAYMENT_METHOD?.trim() || 'bank_transfer';
  }
  if (railNormalized === 'mercado_pago' || railNormalized === 'mercadopago') {
    return 'mercado_pago';
  }
  return railNormalized;
}

export function ripioChainForNetwork(networkId?: string | null): { chain: string; currency: string } {
  if (ripioSandbox()) {
    return {
      chain: process.env.RIPIO_SANDBOX_CHAIN?.trim() || 'ETHEREUM_SEPOLIA',
      currency: process.env.RIPIO_SANDBOX_CURRENCY?.trim() || 'RTEST'
    };
  }

  const normalized = (networkId ?? 'BASE').trim().toUpperCase() as StablecoinNetworkId;
  if (normalized !== 'BASE') {
    throw new Error('CHAIN_MISMATCH');
  }
  return {
    chain: process.env.RIPIO_CHAIN?.trim() || 'BASE',
    currency: 'USDC'
  };
}

export function resolveRipioFiatAmount(amountUsd: number): { currency: string; amount: string } {
  const fx = Number(process.env.RIPIO_FX_ARS ?? process.env.DLOCAL_FX_ARS ?? 1050);
  const fxRate = Number.isFinite(fx) && fx > 0 ? fx : 1050;
  return {
    currency: 'ARS',
    amount: (amountUsd * fxRate).toFixed(2)
  };
}

async function acquireRipioAccessToken(): Promise<string> {
  const clientId = process.env.RIPIO_CLIENT_ID?.trim();
  const clientSecret = process.env.RIPIO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('RIPIO_NOT_CONFIGURED');
  }

  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const response = await fetch(`${ripioApiBaseUrl()}/oauth2/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const body = (await response.json()) as {
    accessToken?: string;
    access_token?: string;
    expiresIn?: number;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error ?? `RIPIO_AUTH_${response.status}`);
  }

  const accessToken = body.accessToken ?? body.access_token;
  if (!accessToken) {
    throw new Error('RIPIO_AUTH_MISSING_TOKEN');
  }

  const expiresIn = body.expiresIn ?? body.expires_in ?? 3600;
  tokenCache = {
    accessToken,
    expiresAtMs: Date.now() + expiresIn * 1000
  };
  return accessToken;
}

export async function ripioApi<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
  }
): Promise<T> {
  const accessToken = await acquireRipioAccessToken();
  const response = await fetch(`${ripioApiBaseUrl()}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: options?.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const parsed = text
    ? (JSON.parse(text) as T & { detail?: { message?: string }; type?: string })
    : ({} as T & { detail?: { message?: string }; type?: string });

  if (!response.ok) {
    const message = parsed.detail?.message ?? parsed.type ?? text.slice(0, 200);
    throw new Error(`RIPIO_${response.status}:${message}`);
  }

  return parsed;
}

export function formatRipioFiatInstructions(
  instructions: Record<string, unknown> | null | undefined
): string {
  if (!instructions) {
    return 'Completa el depósito ARS con las instrucciones de Ripio.';
  }

  const parts: string[] = [];
  if (typeof instructions.cvu === 'string' && instructions.cvu.trim()) {
    parts.push(`CVU: ${instructions.cvu.trim()}`);
  }
  if (typeof instructions.alias === 'string' && instructions.alias.trim()) {
    parts.push(`Alias: ${instructions.alias.trim()}`);
  }
  if (typeof instructions.clabe === 'string' && instructions.clabe.trim()) {
    parts.push(`CLABE: ${instructions.clabe.trim()}`);
  }
  if (typeof instructions.paymentUrl === 'string' && instructions.paymentUrl.trim()) {
    parts.push(`Pago: ${instructions.paymentUrl.trim()}`);
  }

  return parts.length > 0
    ? `Transfiere ARS usando: ${parts.join(' · ')}`
    : 'Completa el depósito ARS con las instrucciones de Ripio.';
}

export function verifyRipioWebhookSignature(input: {
  secret?: string | null;
  payload: string;
  signature?: string | null;
}): boolean {
  const secret = input.secret?.trim();
  if (!secret) {
    return !isProductionRuntime();
  }
  if (!input.signature) {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', secret).update(input.payload).digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
  } catch {
    return false;
  }
}
