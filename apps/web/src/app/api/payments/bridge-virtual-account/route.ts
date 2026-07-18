import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { buildBridgeVirtualAccountInstructions } from '../../../../lib/checkout/bridgeVirtualAccountService';
import type { BridgeVirtualAccountInstructions } from '../../../../lib/checkout/paymentRouteTypes';
import { isProductionRuntime } from '../../../../lib/runtime/environment';
import { getStablecoinNetwork } from '../../../../lib/payments/stablecoinNetworks';

const BRIDGE_API_BASE = 'https://api.bridge.xyz/v0';

/** Treasury address on Base for virtual account destination */
function getTreasuryAddress(): string {
  return (
    process.env.TREASURY_WALLET_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_TREASURY_ADDRESS?.trim() ||
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() ||
    getStablecoinNetwork('BASE').treasuryAddress ||
    ''
  );
}

function getBridgeApiKey(): string | undefined {
  return process.env.BRIDGE_API_KEY?.trim() || undefined;
}

type BridgeApiCustomer = {
  id: string;
  email: string;
  kyc_status?: string;
};

type BridgeApiVirtualAccount = {
  id: string;
  status: string;
  source_deposit_instructions?: {
    bank_name?: string;
    bank_beneficiary_name?: string;
    bank_routing_number?: string;
    bank_account_number?: string;
    bank_address?: string;
    payment_rails?: string[];
    currency?: string;
  };
};

async function bridgeFetch<T>(
  path: string,
  apiKey: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BRIDGE_API_BASE}${path}`, {
    ...options,
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Bridge API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function getOrCreateBridgeCustomer(
  apiKey: string,
  userId: string,
  email: string
): Promise<BridgeApiCustomer> {
  const externalId = `sanova-${userId}`;
  const customers = await bridgeFetch<{ data: BridgeApiCustomer[] }>(
    `/customers?external_id=${encodeURIComponent(externalId)}`,
    apiKey
  );
  if (customers.data.length > 0 && customers.data[0]) {
    return customers.data[0];
  }
  return bridgeFetch<BridgeApiCustomer>('/customers', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      external_id: externalId,
      email,
      type: 'individual'
    })
  });
}

async function getOrCreateVirtualAccount(
  apiKey: string,
  customerId: string,
  referenceId: string
): Promise<BridgeApiVirtualAccount> {
  const accounts = await bridgeFetch<{ data: BridgeApiVirtualAccount[] }>(
    `/customers/${customerId}/virtual_accounts`,
    apiKey
  );
  const active = accounts.data.find((a) => a.status === 'activated');
  if (active) return active;

  const treasury = getTreasuryAddress();
  if (!treasury) throw new Error('TREASURY_NOT_CONFIGURED');

  const idempotencyKey = `sanova-va-${customerId}-${referenceId}`.slice(0, 64);
  return bridgeFetch<BridgeApiVirtualAccount>(`/customers/${customerId}/virtual_accounts`, apiKey, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({
      source: { currency: 'usd' },
      destination: {
        payment_rail: 'base',
        currency: 'usdc',
        address: treasury
      },
      developer_fee_percent: '0.8'
    })
  });
}

function buildInstructionsFromBridgeAccount(
  account: BridgeApiVirtualAccount,
  amountUsd: number,
  referenceId: string,
  investorName: string
): BridgeVirtualAccountInstructions {
  const ins = account.source_deposit_instructions;
  const suffix = referenceId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'SANOVA';
  return {
    bankName: ins?.bank_name ?? 'Lead Bank (Bridge Partner)',
    accountName: ins?.bank_beneficiary_name ?? investorName,
    accountNumber: ins?.bank_account_number ?? '—',
    routingNumber: ins?.bank_routing_number ?? '—',
    swift: 'BRDGUS33',
    beneficiaryAddress: ins?.bank_address ?? '548 Market St, San Francisco, CA 94104, US',
    reference: referenceId,
    amountUsd,
    currency: ins?.currency?.toUpperCase() ?? 'USD',
    memo: `SANOVA-WIRE-${suffix}`,
    estimatedSettlement: '1–3 business days (ACH/Wire)'
  };
}

export type BridgeVirtualAccountResponse = {
  instructions: BridgeVirtualAccountInstructions;
  isSimulated: boolean;
  error?: string;
};

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const referenceId = searchParams.get('referenceId') ?? 'SANOVA-REF';
  const amountUsd = Number(searchParams.get('amountUsd') ?? '0');

  const session = await auth();
  const investorName = session?.user?.name ?? 'SANOVA CAPITAL INVESTOR';
  const userId = session?.user?.id;
  const email = session?.user?.email;

  const apiKey = getBridgeApiKey();
  const allowSimulated = !isProductionRuntime() || process.env.BRIDGE_ALLOW_SIMULATED_VA === 'true';

  if (!apiKey) {
    if (!allowSimulated) {
      return NextResponse.json(
        { error: 'BRIDGE_NOT_CONFIGURED', isSimulated: false } satisfies Partial<BridgeVirtualAccountResponse> & {
          error: string;
        },
        { status: 503 }
      );
    }
    const instructions = buildBridgeVirtualAccountInstructions({
      amountUsd,
      referenceId,
      investorName
    });
    return NextResponse.json({ instructions, isSimulated: true } satisfies BridgeVirtualAccountResponse);
  }

  if (!userId || !email) {
    return NextResponse.json(
      { error: 'AUTH_REQUIRED', isSimulated: false } satisfies Partial<BridgeVirtualAccountResponse> & {
        error: string;
      },
      { status: 401 }
    );
  }

  try {
    const customer = await getOrCreateBridgeCustomer(apiKey, userId, email);
    const account = await getOrCreateVirtualAccount(apiKey, customer.id, referenceId);
    const instructions = buildInstructionsFromBridgeAccount(
      account,
      amountUsd,
      referenceId,
      investorName
    );
    return NextResponse.json({ instructions, isSimulated: false } satisfies BridgeVirtualAccountResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'BRIDGE_VA_FAILED';
    if (!allowSimulated) {
      return NextResponse.json(
        { error: message, isSimulated: false } satisfies Partial<BridgeVirtualAccountResponse> & {
          error: string;
        },
        { status: 502 }
      );
    }
    const instructions = buildBridgeVirtualAccountInstructions({
      amountUsd,
      referenceId,
      investorName
    });
    return NextResponse.json({
      instructions,
      isSimulated: true,
      error: message
    } satisfies BridgeVirtualAccountResponse);
  }
}
