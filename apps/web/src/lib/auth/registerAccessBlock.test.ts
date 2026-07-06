import { describe, expect, it } from 'vitest';
import { isRegisterOAuthBlocked } from './registerAccessBlock';

describe('registerAccessBlock', () => {
  it('blocks OAuth for pre-check access errors', () => {
    expect(isRegisterOAuthBlocked('OAUTH_ONLY_DISABLED')).toBe(true);
    expect(isRegisterOAuthBlocked('INVESTOR_ACCESS_NOT_ENABLED')).toBe(true);
    expect(isRegisterOAuthBlocked('REGION_NOT_AVAILABLE')).toBe(true);
    expect(isRegisterOAuthBlocked('EMAIL_CHECK_FAILED')).toBe(true);
  });

  it('allows OAuth when email is in use (existing account may use OAuth)', () => {
    expect(isRegisterOAuthBlocked('EMAIL_IN_USE')).toBe(false);
    expect(isRegisterOAuthBlocked(null)).toBe(false);
    expect(isRegisterOAuthBlocked(undefined)).toBe(false);
  });
});
