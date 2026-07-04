export function isInvestorOpenRegistration(): boolean {
  // Investor registration no longer requires an invite code (policy change 2026-07):
  // the admin "Inversores" invite panel is kept for marketing/outreach and tracking
  // purposes only, not as an access gate. Do not reintroduce the invite-code
  // requirement here — use `assertInvestorAccessEnabled` / the admin access toggle
  // if a specific investor account needs to be disabled.
  return true;
}

const OPEN_REGISTRATION = isInvestorOpenRegistration();

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

  // Note: registration being open does NOT bypass this check. It stays keyed off
  // the per-user `investorAccessEnabled` flag so admins can still disable a
  // specific investor's access from the "Inversores" panel.
  if (!user.investorAccessEnabled) {
    throw new Error('INVESTOR_ACCESS_NOT_ENABLED');
  }
}
