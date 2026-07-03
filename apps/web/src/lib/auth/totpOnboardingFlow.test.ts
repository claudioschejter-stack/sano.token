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

  it('shows provision first for brand-new mobile setup even with totpMode hint in URL', () => {
    expect(
      initialTotpOnboardingStep({
        isMobile: true,
        pendingSetup: false
      })
    ).toBe('provision');
  });

  it('resumes on confirm when session stored the confirm step', () => {
    expect(
      initialTotpOnboardingStep({
        isMobile: true,
        storedStep: 'confirm'
      })
    ).toBe('confirm');
  });
});
