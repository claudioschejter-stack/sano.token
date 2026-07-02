import { describe, expect, it } from 'vitest';
import { requiresOnboardingGatePath, shouldRedirectToOnboarding } from './middlewarePolicy';

describe('middlewarePolicy', () => {
  it('matches portal paths that require onboarding completion', () => {
    expect(requiresOnboardingGatePath('/dashboard')).toBe(true);
    expect(requiresOnboardingGatePath('/marketplace/carrito')).toBe(true);
    expect(requiresOnboardingGatePath('/kyc')).toBe(false);
    expect(requiresOnboardingGatePath('/acceso')).toBe(false);
  });

  it('redirects investors who are not operational', () => {
    expect(
      shouldRedirectToOnboarding({
        pathname: '/dashboard',
        role: 'INVESTOR',
        accountOperational: false
      })
    ).toBe(true);
  });

  it('allows operational investors through', () => {
    expect(
      shouldRedirectToOnboarding({
        pathname: '/marketplace',
        role: 'INVESTOR',
        accountOperational: true
      })
    ).toBe(false);
  });

  it('allows admin without operational flag', () => {
    expect(
      shouldRedirectToOnboarding({
        pathname: '/dashboard',
        role: 'ADMIN',
        accountOperational: false
      })
    ).toBe(false);
  });
});
