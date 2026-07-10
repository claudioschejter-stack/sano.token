import { describe, expect, it } from 'vitest';
import { resolveOnboardingStepParam } from './resolveOnboardingStepParam';
import type { OnboardingChecklist } from './accountStatus';

const baseChecklist: OnboardingChecklist = {
  email: 'test@example.com',
  phone: '+542617513426',
  emailVerified: true,
  contactVerified: true,
  phoneVerified: true,
  kycEnabled: true,
  kycApproved: false,
  kycStatus: 'PENDING',
  accountStatus: 'ACTIVE',
  walletLinked: false,
  walletAddress: null,
  walletProvider: null,
  totpEnabled: false,
  diditEnabled: true,
  allowDemoKyc: false,
  operational: false
};

describe('resolveOnboardingStepParam', () => {
  it('returns email when contact is incomplete', () => {
    expect(
      resolveOnboardingStepParam(
        { ...baseChecklist, emailVerified: false, contactVerified: false },
        true
      )
    ).toBe('email');
  });

  it('returns identity when KYC is pending', () => {
    expect(resolveOnboardingStepParam(baseChecklist, true)).toBe('identity');
  });

  it('returns wallet when payments are pending', () => {
    expect(
      resolveOnboardingStepParam({ ...baseChecklist, kycApproved: true }, true)
    ).toBe('wallet');
  });

  it('returns null once KYC and wallet are complete (2FA is optional, desktop-only)', () => {
    expect(
      resolveOnboardingStepParam(
        { ...baseChecklist, kycApproved: true, walletLinked: true },
        true
      )
    ).toBeNull();
  });

  it('returns null when all investor steps are complete', () => {
    expect(
      resolveOnboardingStepParam(
        { ...baseChecklist, kycApproved: true, walletLinked: true, totpEnabled: true },
        true
      )
    ).toBeNull();
  });
});
