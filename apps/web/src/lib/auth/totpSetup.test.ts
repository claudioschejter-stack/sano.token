import { describe, expect, it, vi } from 'vitest';
import { resolveTotpSetup } from './totpSetup';

vi.mock('./totpService', () => ({
  decryptTotpSecret: vi.fn((value: string) => `decrypted:${value}`),
  encryptTotpSecret: vi.fn((value: string) => `encrypted:${value}`),
  generateTotpSecret: vi.fn(() => 'NEW-SECRET'),
  getTotpUri: vi.fn((secret: string, email: string) => `otpauth://totp/${email}?secret=${secret}`)
}));

describe('resolveTotpSetup', () => {
  it('reuses pending secret instead of generating a new one', () => {
    const result = resolveTotpSetup({
      email: 'user@example.com',
      totpSecret: 'stored-secret',
      totpEnabled: false
    });

    expect(result).toMatchObject({
      secret: 'decrypted:stored-secret',
      reused: true
    });
  });

  it('generates a fresh secret when forced', () => {
    const result = resolveTotpSetup({
      email: 'user@example.com',
      totpSecret: 'stored-secret',
      totpEnabled: false,
      force: true
    });

    expect(result).toMatchObject({
      secret: 'NEW-SECRET',
      reused: false
    });
  });

  it('blocks setup when TOTP is already enabled', () => {
    expect(
      resolveTotpSetup({
        email: 'user@example.com',
        totpSecret: 'stored-secret',
        totpEnabled: true
      })
    ).toEqual({ error: 'ALREADY_ENABLED' });
  });
});
