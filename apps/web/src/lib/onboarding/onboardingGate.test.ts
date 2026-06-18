import { describe, expect, it } from 'vitest';
import {
  canAccessPortalWithoutInvestorOnboarding,
  requiresInvestorStyleOnboarding
} from './onboardingGate';

describe('onboardingGate', () => {
  it('requires onboarding for investors and advisors', () => {
    expect(requiresInvestorStyleOnboarding('INVESTOR')).toBe(true);
    expect(requiresInvestorStyleOnboarding('ADVISOR')).toBe(true);
    expect(requiresInvestorStyleOnboarding('ADVISOR_MANAGER')).toBe(true);
    expect(requiresInvestorStyleOnboarding('ADMIN')).toBe(false);
    expect(requiresInvestorStyleOnboarding('OPERATOR')).toBe(false);
    expect(requiresInvestorStyleOnboarding('TREASURY')).toBe(false);
  });

  it('lets platform ops access the portal without investor onboarding', () => {
    expect(canAccessPortalWithoutInvestorOnboarding('ADMIN')).toBe(true);
    expect(canAccessPortalWithoutInvestorOnboarding('TREASURY')).toBe(true);
    expect(canAccessPortalWithoutInvestorOnboarding('INVESTOR')).toBe(false);
    expect(canAccessPortalWithoutInvestorOnboarding('ADVISOR')).toBe(false);
  });
});
