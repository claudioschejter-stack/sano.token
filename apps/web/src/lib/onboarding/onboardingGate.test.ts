import { describe, expect, it } from 'vitest';
import {
  canAccessPortalWithoutInvestorOnboarding,
  requiresInvestorStyleOnboarding
} from './onboardingGate';

describe('onboardingGate', () => {
  it('requires onboarding only for investors', () => {
    expect(requiresInvestorStyleOnboarding('INVESTOR')).toBe(true);
    expect(requiresInvestorStyleOnboarding('ADMIN')).toBe(false);
    expect(requiresInvestorStyleOnboarding('OPERATOR')).toBe(false);
    expect(requiresInvestorStyleOnboarding('ADVISOR')).toBe(false);
  });

  it('lets staff access the portal without investor onboarding', () => {
    expect(canAccessPortalWithoutInvestorOnboarding('ADMIN')).toBe(true);
    expect(canAccessPortalWithoutInvestorOnboarding('INVESTOR')).toBe(false);
  });
});
