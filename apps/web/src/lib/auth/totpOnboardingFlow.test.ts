import { describe, expect, it } from 'vitest';
import { initialTotpOnboardingStep, shouldStartTotpOnConfirmStep } from './totpOnboardingFlow';

describe('totpOnboardingFlow', () => {
  it('skips GA provisioning when setup is already pending', () => {
    expect(
      shouldStartTotpOnConfirmStep({
        pendingSetup: true
      })
    ).toBe(true);
    expect(
      initialTotpOnboardingStep({
        isMobile: true,
        pendingSetup: true
      })
    ).toBe('confirm');
  });

  it('starts on confirm when returning from mobile login', () => {
    expect(
      initialTotpOnboardingStep({
        isMobile: true,
        preferConfirm: true
      })
    ).toBe('confirm');
  });

  it('shows provision first only for brand-new mobile setup', () => {
    expect(
      initialTotpOnboardingStep({
        isMobile: true,
        pendingSetup: false,
        preferConfirm: false
      })
    ).toBe('provision');
  });
});
