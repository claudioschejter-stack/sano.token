import { randomUUID } from 'node:crypto';
import { getStablecoinNetwork } from './stablecoinNetworks';

export const BRIDGE_API_BASE = 'https://api.bridge.xyz/v0';

export type BridgeSourceCurrency = 'usd' | 'eur' | 'mxn' | 'brl' | 'gbp';

export type BridgeApiCustomer = {
  id: string;
  email?: string;
  full_name?: string;
  type?: string;
  kyc_status?: string;
  tos_status?: string;
};

export type BridgeKycLink = {
  id: string;
  full_name: string;
  email: string;
  type: string;
  kyc_link: string;
  tos_link: string;
  kyc_status: string;
  tos_status: string;
  customer_id: string;
  rejection_reasons?: string[];
};

export type BridgeDepositInstructions = {
  currency?: string;
  bank_name?: string;
  bank_address?: string;
  bank_routing_number?: string;
  bank_account_number?: string;
  bank_beneficiary_name?: string;
  bank_beneficiary_address?: string;
  account_holder_name?: string;
  payment_rail?: string;
  payment_rails?: string[];
  iban?: string;
  bic?: string;
  clabe?: string;
  br_code?: string;
  account_number?: string;
  sort_code?: string;
};

export type BridgeApiVirtualAccount = {
  id: string;
  status: string;
  customer_id?: string;
  developer_fee_percent?: string;
  source_deposit_instructions?: BridgeDepositInstructions;
  destination?: {
    currency?: string;
    payment_rail?: string;
    address?: string;
  };
};

export function getBridgeApiKey(): string | undefined {
  return process.env.BRIDGE_API_KEY?.trim() || undefined;
}

export function getBridgeTreasuryAddress(): string {
  return (
    process.env.TREASURY_WALLET_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_TREASURY_ADDRESS?.trim() ||
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() ||
    getStablecoinNetwork('BASE').treasuryAddress ||
    ''
  );
}

export function getBridgeDeveloperFeePercent(): string {
  const raw = process.env.BRIDGE_DEVELOPER_FEE_PERCENT?.trim();
  if (raw && Number.isFinite(Number(raw))) return raw;
  return '0.8';
}

/** Map investor country → Bridge VA source currency. AR stays on MP/Ripio (not Bridge). */
export function bridgeSourceCurrencyForCountry(country: string): BridgeSourceCurrency {
  switch (country.trim().toUpperCase()) {
    case 'EU':
    case 'DE':
    case 'FR':
    case 'ES':
    case 'IT':
    case 'NL':
    case 'PT':
    case 'IE':
    case 'AT':
    case 'BE':
      return 'eur';
    case 'MX':
      return 'mxn';
    case 'BR':
      return 'brl';
    case 'GB':
      return 'gbp';
    case 'US':
    case 'CA':
    case 'AU':
    default:
      return 'usd';
  }
}

export function isBridgeWireCountry(country: string): boolean {
  const c = country.trim().toUpperCase();
  if (c === 'AR') return false;
  return ['US', 'EU', 'GB', 'CA', 'AU', 'MX', 'BR', 'DE', 'FR', 'ES', 'IT', 'NL', 'PT', 'IE'].includes(c);
}

export function settlementHintForRails(rails: string[] | undefined, currency: string): string {
  const set = new Set((rails ?? []).map((r) => r.toLowerCase()));
  if (set.has('pix') || currency === 'BRL') return 'Minutos (Pix)';
  if (set.has('spei') || currency === 'MXN') return 'Minutos / mismo día (SPEI)';
  if (set.has('faster_payments') || currency === 'GBP') return 'Minutos (Faster Payments)';
  if (set.has('sepa') || currency === 'EUR') return '1–2 días hábiles (SEPA)';
  return '1–3 días hábiles (ACH/Wire)';
}

export async function bridgeFetch<T>(
  path: string,
  apiKey: string,
  options?: RequestInit & { idempotencyKey?: string }
): Promise<T> {
  const { idempotencyKey, ...init } = options ?? {};
  const res = await fetch(`${BRIDGE_API_BASE}${path}`, {
    ...init,
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(init.headers ?? {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Bridge API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function findBridgeCustomerByExternalId(
  apiKey: string,
  externalId: string
): Promise<BridgeApiCustomer | null> {
  const listed = await bridgeFetch<{ data?: BridgeApiCustomer[] } | BridgeApiCustomer[]>(
    `/customers?external_id=${encodeURIComponent(externalId)}`,
    apiKey
  );
  const rows = Array.isArray(listed) ? listed : listed.data ?? [];
  return rows[0] ?? null;
}

export async function findBridgeCustomerByEmail(
  apiKey: string,
  email: string
): Promise<BridgeApiCustomer | null> {
  const listed = await bridgeFetch<{ data?: BridgeApiCustomer[] } | BridgeApiCustomer[]>(
    `/customers?email=${encodeURIComponent(email)}`,
    apiKey
  );
  const rows = Array.isArray(listed) ? listed : listed.data ?? [];
  return rows[0] ?? null;
}

export async function createBridgeKycLink(input: {
  apiKey: string;
  fullName: string;
  email: string;
  type?: 'individual' | 'business';
}): Promise<BridgeKycLink> {
  return bridgeFetch<BridgeKycLink>('/kyc_links', input.apiKey, {
    method: 'POST',
    idempotencyKey: randomUUID(),
    body: JSON.stringify({
      full_name: input.fullName,
      email: input.email,
      type: input.type ?? 'individual'
    })
  });
}

async function attachExternalId(apiKey: string, customerId: string, externalId: string): Promise<void> {
  try {
    await bridgeFetch(`/customers/${customerId}`, apiKey, {
      method: 'PUT',
      body: JSON.stringify({ external_id: externalId })
    });
  } catch {
    // Non-fatal: lookup by email still works on subsequent visits.
  }
}

export async function getOrCreateBridgeCustomer(input: {
  apiKey: string;
  userId: string;
  email: string;
  fullName: string;
}): Promise<{ customer: BridgeApiCustomer; kycLink?: BridgeKycLink }> {
  const externalId = `sanova-${input.userId}`;
  const existing =
    (await findBridgeCustomerByExternalId(input.apiKey, externalId)) ??
    (await findBridgeCustomerByEmail(input.apiKey, input.email));
  if (existing) {
    void attachExternalId(input.apiKey, existing.id, externalId);
    return { customer: existing };
  }

  // Prefer KYC Links so Persona + ToS are created with the customer.
  const kycLink = await createBridgeKycLink({
    apiKey: input.apiKey,
    fullName: input.fullName,
    email: input.email
  });

  void attachExternalId(input.apiKey, kycLink.customer_id, externalId);

  return {
    customer: {
      id: kycLink.customer_id,
      email: kycLink.email,
      full_name: kycLink.full_name,
      type: kycLink.type,
      kyc_status: kycLink.kyc_status,
      tos_status: kycLink.tos_status
    },
    kycLink
  };
}

export function isBridgeCustomerReady(customer: BridgeApiCustomer, kycLink?: BridgeKycLink): boolean {
  const kyc = (kycLink?.kyc_status ?? customer.kyc_status ?? '').toLowerCase();
  const tos = (kycLink?.tos_status ?? customer.tos_status ?? '').toLowerCase();

  if (['not_started', 'incomplete', 'under_review', 'rejected', 'pending'].includes(kyc)) {
    return false;
  }
  if (['pending', 'not_started'].includes(tos)) {
    return false;
  }
  // approved / active / empty (legacy pre-approved customers)
  return true;
}

export async function getOrCreateBridgeVirtualAccount(input: {
  apiKey: string;
  customerId: string;
  sourceCurrency: BridgeSourceCurrency;
  referenceId: string;
}): Promise<BridgeApiVirtualAccount> {
  const treasury = getBridgeTreasuryAddress();
  if (!treasury) throw new Error('TREASURY_NOT_CONFIGURED');

  const listed = await bridgeFetch<{ data?: BridgeApiVirtualAccount[] } | BridgeApiVirtualAccount[]>(
    `/customers/${input.customerId}/virtual_accounts`,
    input.apiKey
  );
  const rows = Array.isArray(listed) ? listed : listed.data ?? [];
  const match = rows.find((account) => {
    const currency = account.source_deposit_instructions?.currency?.toLowerCase();
    const destRail = account.destination?.payment_rail?.toLowerCase();
    const destCurrency = account.destination?.currency?.toLowerCase();
    return (
      account.status === 'activated' &&
      currency === input.sourceCurrency &&
      (!destRail || destRail === 'base') &&
      (!destCurrency || destCurrency === 'usdc')
    );
  });
  if (match) return match;

  const idempotencyKey = `sanova-va-${input.customerId}-${input.sourceCurrency}-${input.referenceId}`.slice(0, 64);
  return bridgeFetch<BridgeApiVirtualAccount>(`/customers/${input.customerId}/virtual_accounts`, input.apiKey, {
    method: 'POST',
    idempotencyKey,
    body: JSON.stringify({
      source: { currency: input.sourceCurrency },
      destination: {
        payment_rail: 'base',
        currency: 'usdc',
        address: treasury
      },
      developer_fee_percent: getBridgeDeveloperFeePercent()
    })
  });
}
