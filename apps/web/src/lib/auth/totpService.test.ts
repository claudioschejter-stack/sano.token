import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticator } from 'otplib';

describe('totpService', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TOTP_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.AUTH_SECRET = 'b'.repeat(48);
  });

  it('encrypts and decrypts a TOTP secret without altering it', async () => {
    const { encryptTotpSecret, decryptTotpSecret } = await import('./totpService');
    const secret = authenticator.generateSecret(20);

    const stored = encryptTotpSecret(secret);
    expect(decryptTotpSecret(stored)).toBe(secret);
  });

  it('verifies a code generated from the same secret', async () => {
    const { verifyTotpCode } = await import('./totpService');
    const secret = authenticator.generateSecret(20);
    const token = authenticator.generate(secret);

    expect(verifyTotpCode(secret, token)).toBe(true);
  });
});
