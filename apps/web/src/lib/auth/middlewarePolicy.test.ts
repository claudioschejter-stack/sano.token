import { describe, expect, it } from 'vitest';
import {
  allowsMarketplaceBrowse,
  isMarketplaceTransactionPath,
  requiresOnboardingGatePath,
  shouldRedirectToOnboarding
} from './middlewarePolicy';

describe('middlewarePolicy', () => {
  it('matches portal paths that require onboarding completion', () => {
    expect(requiresOnboardingGatePath('/dashboard')).toBe(true);
    expect(requiresOnboardingGatePath('/marketplace/carrito')).toBe(true);
    expect(requiresOnboardingGatePath('/marketplace/proj-1/agregar')).toBe(true);
    expect(requiresOnboardingGatePath('/kyc')).toBe(false);
    expect(requiresOnboardingGatePath('/acceso')).toBe(false);
  });

  it('allows marketplace browse without onboarding gate', () => {
    expect(requiresOnboardingGatePath('/marketplace')).toBe(false);
    expect(isMarketplaceTransactionPath('/marketplace')).toBe(false);
    expect(allowsMarketplaceBrowse('/marketplace')).toBe(true);
    expect(allowsMarketplaceBrowse('/marketplace/proyecto-a')).toBe(true);
    expect(allowsMarketplaceBrowse('/marketplace/proyecto-a/agregar')).toBe(false);
  });

  it('redirects investors who are not operational on gated paths', () => {
    expect(
      shouldRedirectToOnboarding({
        pathname: '/dashboard',
        role: 'INVESTOR',
        accountOperational: false
      })
    ).toBe(true);

    expect(
      shouldRedirectToOnboarding({
        pathname: '/marketplace/carrito',
        role: 'INVESTOR',
        accountOperational: false
      })
    ).toBe(true);
  });

  it('allows non-operational investors to browse marketplace listing', () => {
    expect(
      shouldRedirectToOnboarding({
        pathname: '/marketplace',
        role: 'INVESTOR',
        accountOperational: false
      })
    ).toBe(false);
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
