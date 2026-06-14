type LendingErrorMessages = {
  walletNotLinked: string;
  walletMismatch: string;
  wrongNetwork: string;
  prepareFailed: string;
  previewFailed: string;
  kycRequired: string;
  accountNotOperational: string;
};

const LENDING_ERROR_CODES = new Set([
  'KYC_NOT_APPROVED',
  'INVESTOR_WALLET_REQUIRED',
  'WALLET_MISMATCH',
  'WALLET_REQUIRED',
  'INVALID_WALLET',
  'INVESTOR_ROLE_REQUIRED',
  'ACCOUNT_NOT_OPERATIONAL',
  'INVESTOR_ACCESS_NOT_ENABLED',
  'FORBIDDEN'
]);

export function isKnownLendingApiError(code: string | undefined): boolean {
  return Boolean(code && LENDING_ERROR_CODES.has(code));
}

export function resolveLendingApiErrorMessage(code: string | undefined, messages: LendingErrorMessages): string {
  switch (code) {
    case 'KYC_NOT_APPROVED':
      return messages.kycRequired;
    case 'INVESTOR_WALLET_REQUIRED':
    case 'WALLET_REQUIRED':
      return messages.walletNotLinked;
    case 'WALLET_MISMATCH':
      return messages.walletMismatch;
    case 'ACCOUNT_NOT_OPERATIONAL':
    case 'INVESTOR_ACCESS_NOT_ENABLED':
    case 'FORBIDDEN':
    case 'INVESTOR_ROLE_REQUIRED':
      return messages.accountNotOperational;
    default:
      return messages.prepareFailed;
  }
}

export function resolveBorrowPreviewErrorMessage(code: string | undefined, messages: LendingErrorMessages): string {
  if (!code) {
    return messages.previewFailed;
  }
  return resolveLendingApiErrorMessage(code, messages);
}
