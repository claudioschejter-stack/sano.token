import { describe, expect, it } from 'vitest';
import { verifyBackupCode, verifyTotpCode } from './totpService';

/**
 * The verifiers decide what counts as their credential, instead of the route
 * branching on what the submission looks like. When the caller makes that
 * decision, the request controls whether the check runs at all.
 */
describe('los verificadores juzgan su propia entrada', () => {
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

  it('un código que no es de 6 dígitos simplemente no es el código', () => {
    expect(verifyTotpCode(secret, '')).toBe(false);
    expect(verifyTotpCode(secret, '12345')).toBe(false);
    expect(verifyTotpCode(secret, '1234567')).toBe(false);
    expect(verifyTotpCode(secret, 'abcdef')).toBe(false);
    expect(verifyTotpCode(secret, null)).toBe(false);
    expect(verifyTotpCode(secret, undefined)).toBe(false);
  });

  it('tolera espacios alrededor, que es como se pega desde el mail', () => {
    // Not a match either way, but it must reach the comparison rather than be
    // rejected for its shape.
    expect(verifyTotpCode(secret, ' 000000 ')).toBe(false);
  });

  it('un respaldo vacío no se compara contra ningún hash', async () => {
    const hashes = ['$2a$10$abcdefghijklmnopqrstuv'];
    await expect(verifyBackupCode('', hashes)).resolves.toBe(-1);
    await expect(verifyBackupCode(null, hashes)).resolves.toBe(-1);
    await expect(verifyBackupCode('   ', hashes)).resolves.toBe(-1);
  });

  it('sin códigos guardados, cualquier respaldo falla', async () => {
    await expect(verifyBackupCode('ABCDE-12345', [])).resolves.toBe(-1);
  });
});
