type AccessErrorMessages = {
  authError: string;
  oauthTermsRequired?: string;
  investorAccessNotEnabled?: string;
  accountLocked?: string;
  register: {
    errors: {
      REGION_NOT_AVAILABLE: string;
      TERMS_NOT_ACCEPTED: string;
    };
  };
};

export function resolveAccessPageError(
  authError: string | null,
  messages: AccessErrorMessages
): string | null {
  if (!authError) {
    return null;
  }

  if (authError === 'REGION_NOT_AVAILABLE') {
    return messages.register.errors.REGION_NOT_AVAILABLE;
  }

  if (authError === 'TERMS_NOT_ACCEPTED') {
    return messages.register.errors.TERMS_NOT_ACCEPTED;
  }

  if (authError === 'INVESTOR_ACCESS_NOT_ENABLED') {
    return messages.investorAccessNotEnabled ?? messages.authError;
  }

  if (authError === 'CUENTA_BLOQUEADA') {
    return messages.accountLocked ?? messages.authError;
  }

  return messages.authError;
}
