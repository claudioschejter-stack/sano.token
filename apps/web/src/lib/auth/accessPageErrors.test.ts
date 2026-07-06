import { describe, expect, it } from 'vitest';
import { resolveAccessPageError } from './accessPageErrors';

describe('resolveAccessPageError', () => {
  const messages = {
    authError: 'Generic auth error',
    investorAccessNotEnabled: 'Investor access disabled',
    accountLocked: 'Account locked',
    register: {
      errors: {
        REGION_NOT_AVAILABLE: 'Region blocked',
        TERMS_NOT_ACCEPTED: 'Terms required'
      }
    }
  };

  it('maps geo-block query param to a dedicated message', () => {
    expect(resolveAccessPageError('REGION_NOT_AVAILABLE', messages)).toBe('Region blocked');
  });

  it('maps OAuth terms error', () => {
    expect(resolveAccessPageError('TERMS_NOT_ACCEPTED', messages)).toBe('Terms required');
  });

  it('maps investor access error', () => {
    expect(resolveAccessPageError('INVESTOR_ACCESS_NOT_ENABLED', messages)).toBe(
      'Investor access disabled'
    );
  });

  it('maps locked account error', () => {
    expect(resolveAccessPageError('CUENTA_BLOQUEADA', messages)).toBe('Account locked');
  });

  it('falls back to generic auth error', () => {
    expect(resolveAccessPageError('auth', messages)).toBe('Generic auth error');
  });

  it('returns null when no error param is present', () => {
    expect(resolveAccessPageError(null, messages)).toBeNull();
  });
});
