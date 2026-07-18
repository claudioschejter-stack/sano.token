import { linkFiatIdentity, listLinkedFiatIdentities } from '../investor/linkedFiatIdentityService';
import {
  createBridgeExternalAccount,
  createBridgeKycLink,
  getBridgeApiKey,
  getOrCreateBridgeCustomer,
  isBridgeCustomerReady,
  listBridgeExternalAccounts,
  bridgeExternalAccountLabel,
  type BridgeExternalAccount,
  type BridgeKycLink,
  type CreateBridgeExternalAccountInput
} from './bridgeClient';

export type BridgeExternalAccountDto = {
  id: string;
  currency: string;
  accountType: string | null;
  bankName: string | null;
  accountName: string | null;
  label: string;
  last4: string | null;
  active: boolean;
};

function toDto(account: BridgeExternalAccount): BridgeExternalAccountDto {
  return {
    id: account.id,
    currency: account.currency,
    accountType: account.account_type ?? null,
    bankName: account.bank_name ?? null,
    accountName: account.account_name ?? null,
    label: bridgeExternalAccountLabel(account),
    last4:
      account.last_4 ??
      account.account?.last_4 ??
      account.iban?.last_4 ??
      account.clabe?.last_4 ??
      null,
    active: account.active !== false
  };
}

export async function ensureBridgeCustomerForUser(input: {
  userId: string;
  email: string;
  fullName: string;
}): Promise<
  | { ok: true; customerId: string; apiKey: string }
  | { ok: false; reason: 'BRIDGE_NOT_CONFIGURED' }
  | {
      ok: false;
      reason: 'KYC_REQUIRED';
      kyc: { customerId: string; kycStatus: string; tosStatus: string; kycLink: string | null; tosLink: string | null };
    }
> {
  const apiKey = getBridgeApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'BRIDGE_NOT_CONFIGURED' };
  }

  const { customer, kycLink } = await getOrCreateBridgeCustomer({
    apiKey,
    userId: input.userId,
    email: input.email,
    fullName: input.fullName
  });

  let activeKyc: BridgeKycLink | undefined = kycLink;
  if (!isBridgeCustomerReady(customer, activeKyc)) {
    if (!activeKyc?.kyc_link) {
      activeKyc = await createBridgeKycLink({
        apiKey,
        fullName: input.fullName,
        email: input.email
      });
    }
    return {
      ok: false,
      reason: 'KYC_REQUIRED',
      kyc: {
        customerId: activeKyc.customer_id || customer.id,
        kycStatus: activeKyc.kyc_status,
        tosStatus: activeKyc.tos_status,
        kycLink: activeKyc.kyc_link ?? null,
        tosLink: activeKyc.tos_link ?? null
      }
    };
  }

  return { ok: true, customerId: customer.id, apiKey };
}

export async function listUserBridgeExternalAccounts(input: {
  userId: string;
  email: string;
  fullName: string;
}): Promise<
  | { ok: true; accounts: BridgeExternalAccountDto[] }
  | { ok: false; reason: 'BRIDGE_NOT_CONFIGURED' | 'KYC_REQUIRED'; kyc?: unknown }
> {
  const gate = await ensureBridgeCustomerForUser(input);
  if (gate.ok === false) {
    if (gate.reason === 'KYC_REQUIRED') {
      return { ok: false, reason: 'KYC_REQUIRED', kyc: gate.kyc };
    }
    return { ok: false, reason: 'BRIDGE_NOT_CONFIGURED' };
  }

  const accounts = await listBridgeExternalAccounts(gate.apiKey, gate.customerId);
  return { ok: true, accounts: accounts.filter((row) => row.active !== false).map(toDto) };
}

export async function linkUserBridgeExternalAccount(input: {
  userId: string;
  email: string;
  fullName: string;
  body: CreateBridgeExternalAccountInput;
}): Promise<
  | { ok: true; account: BridgeExternalAccountDto }
  | { ok: false; reason: 'BRIDGE_NOT_CONFIGURED' | 'KYC_REQUIRED' | 'CREATE_FAILED'; kyc?: unknown; error?: string }
> {
  const gate = await ensureBridgeCustomerForUser(input);
  if (gate.ok === false) {
    if (gate.reason === 'KYC_REQUIRED') {
      return { ok: false, reason: 'KYC_REQUIRED', kyc: gate.kyc };
    }
    return { ok: false, reason: 'BRIDGE_NOT_CONFIGURED' };
  }

  try {
    const created = await createBridgeExternalAccount({
      apiKey: gate.apiKey,
      customerId: gate.customerId,
      body: input.body
    });

    const label = bridgeExternalAccountLabel(created);
    await linkFiatIdentity({
      userId: input.userId,
      provider: 'bridge',
      identifier: created.id,
      label,
      capturedFrom: 'bridge_external_account'
    });

    return { ok: true, account: toDto(created) };
  } catch (error) {
    return {
      ok: false,
      reason: 'CREATE_FAILED',
      error: error instanceof Error ? error.message : 'CREATE_FAILED'
    };
  }
}

export async function listLinkedBridgeIdentities(userId: string) {
  const rows = await listLinkedFiatIdentities(userId);
  return rows.filter((row) => row.provider === 'bridge');
}
