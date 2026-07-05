import { describe, expect, it } from 'vitest';
import {
  buildAndValidateE164Phone,
  normalizeEmail,
  normalizePhoneE164
} from './contactValidation';

describe('normalizeEmail', () => {
  it('lowercases and trims valid emails', () => {
    expect(normalizeEmail('  Victoria.Bragadin@Example.COM  ')).toBe('victoria.bragadin@example.com');
  });

  it('rejects invalid emails', () => {
    expect(normalizeEmail('not-an-email')).toBeNull();
  });
});

describe('buildAndValidateE164Phone (Argentina)', () => {
  it('accepts Mendoza mobile without leading 9', () => {
    expect(buildAndValidateE164Phone('54', '2617513426')).toBe('+5492617513426');
  });

  it('accepts mobile already prefixed with 9', () => {
    expect(buildAndValidateE164Phone('54', '92617513426')).toBe('+5492617513426');
  });

  it('strips domestic 15 prefix before area code', () => {
    expect(buildAndValidateE164Phone('54', '152617513426')).toBe('+5492617513426');
  });

  it('strips leading zero from local number', () => {
    expect(buildAndValidateE164Phone('54', '02617513426')).toBe('+5492617513426');
  });

  it('accepts Buenos Aires mobile format', () => {
    expect(buildAndValidateE164Phone('54', '91123456789')).toBe('+5491123456789');
  });

  it('rejects too-short local numbers', () => {
    expect(buildAndValidateE164Phone('54', '26175134')).toBeNull();
  });
});

describe('normalizePhoneE164', () => {
  it('accepts E164 values produced by the client', () => {
    expect(normalizePhoneE164('+5492617513426')).toBe('+5492617513426');
  });

  it('normalizes Argentina numbers missing the mobile 9 prefix', () => {
    expect(normalizePhoneE164('+542617513426')).toBe('+5492617513426');
  });

  it('rejects bare local numbers without country prefix', () => {
    expect(normalizePhoneE164('2617513426')).toBeNull();
  });
});
