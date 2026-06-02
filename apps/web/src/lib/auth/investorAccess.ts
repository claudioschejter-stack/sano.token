const OPEN_REGISTRATION = process.env.INVESTOR_OPEN_REGISTRATION === 'true';

function configuredInviteCodes(): Set<string> {
  const raw = process.env.INVESTOR_INVITE_CODES?.trim();
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function resolveInvestorAccessOnRegister(inviteCode?: string | null): boolean {
  if (OPEN_REGISTRATION) {
    return true;
  }

  const normalized = inviteCode?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return configuredInviteCodes().has(normalized);
}

export function assertInvestorAccessEnabled(user: { investorAccessEnabled?: boolean | null; systemRole?: string }) {
  if (user.systemRole !== 'INVESTOR') {
    return;
  }

  if (OPEN_REGISTRATION) {
    return;
  }

  if (!user.investorAccessEnabled) {
    throw new Error('INVESTOR_ACCESS_NOT_ENABLED');
  }
}
