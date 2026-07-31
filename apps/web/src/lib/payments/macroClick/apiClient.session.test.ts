import { describe, expect, it } from 'vitest';
import { extractMacroClickSessionToken } from './apiClient';

describe('extractMacroClickSessionToken', () => {
  it('accepts JWT string in data (sandbox Click de Pago shape)', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJndWlkIjoiYWJjIn0.signature';
    expect(
      extractMacroClickSessionToken({
        status: true,
        code: 200,
        data: jwt
      })
    ).toBe(jwt);
  });

  it('accepts nested token object', () => {
    expect(
      extractMacroClickSessionToken({
        data: { token: 'nested.jwt.value' }
      })
    ).toBe('nested.jwt.value');
  });

  it('returns null when missing', () => {
    expect(extractMacroClickSessionToken({ data: '' })).toBeNull();
    expect(extractMacroClickSessionToken({})).toBeNull();
  });
});
