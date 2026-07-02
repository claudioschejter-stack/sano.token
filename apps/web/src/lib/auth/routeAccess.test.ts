import { describe, expect, it } from 'vitest';
import { canAccessPath, getRequiredRolesForPath } from './routeAccess';

describe('getRequiredRolesForPath', () => {
  it('allows any authenticated role on investor security settings', () => {
    expect(getRequiredRolesForPath('/dashboard/settings/security')).toBeNull();
  });

  it('restricts admin settings but not security subpath', () => {
    expect(getRequiredRolesForPath('/dashboard/settings')).toEqual(['ADMIN']);
    expect(getRequiredRolesForPath('/dashboard/settings/general')).toEqual(['ADMIN']);
  });

  it('restricts treasury wallet routes to admin', () => {
    expect(getRequiredRolesForPath('/dashboard/wallet')).toEqual(['ADMIN']);
    expect(getRequiredRolesForPath('/dashboard/wallet-cobro')).toEqual(['ADMIN']);
    expect(getRequiredRolesForPath('/dashboard/waitlist')).toEqual(['ADMIN']);
  });
});

describe('canAccessPath', () => {
  it('lets investors access security settings', () => {
    expect(canAccessPath('INVESTOR', '/dashboard/settings/security')).toBe(true);
  });

  it('blocks investors from admin settings', () => {
    expect(canAccessPath('INVESTOR', '/dashboard/settings')).toBe(false);
  });

  it('blocks investors from treasury wallet pages', () => {
    expect(canAccessPath('INVESTOR', '/dashboard/wallet')).toBe(false);
  });
});
