import type { Messages } from '../../i18n/locales/en';

const INVESTOR_API_ERROR_KEYS = new Set([
  'INVESTOR_ACCESS_NOT_ENABLED',
  'INVESTOR_WALLET_REQUIRED',
  'INVESTOR_ROLE_REQUIRED',
  'ACCOUNT_NOT_OPERATIONAL',
  'KYC_NOT_APPROVED',
  'KYC_REQUIRED',
  'WALLET_REQUIRED',
  'WALLET_MISMATCH',
  'FORBIDDEN',
  'UNAUTHORIZED',
  'BUYER_USDC_ALLOWANCE_REQUIRED',
  'SELLER_VAULT_ALLOWANCE_REQUIRED',
  'INSUFFICIENT_BUYER_USDC',
  'INSUFFICIENT_SELLER_ON_CHAIN_SHARES',
  'ON_CHAIN_SETTLEMENT_UNAVAILABLE',
  'ON_CHAIN_SETTLEMENT_OPERATOR_MISSING'
]);

export function isKnownInvestorApiError(code: string | undefined): boolean {
  return Boolean(code && INVESTOR_API_ERROR_KEYS.has(code));
}

export function resolveInvestorApiErrorMessage(code: string | undefined, t: Messages): string {
  if (!code) {
    return t.apiErrors.generic;
  }

  const key = code as keyof Messages['apiErrors'];
  if (key in t.apiErrors && key !== 'generic') {
    return t.apiErrors[key];
  }

  return t.apiErrors.generic;
}
