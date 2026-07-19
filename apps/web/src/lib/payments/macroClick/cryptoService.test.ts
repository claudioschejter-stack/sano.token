import { describe, expect, it } from 'vitest';
import {
  buildMacroClickHash,
  decryptMacroClickString,
  encryptMacroClickString,
  formatMacroClickAmountCents,
  normalizeMacroClickAesKey
} from './cryptoService';

describe('macroClick cryptoService', () => {
  it('pads secret key to 32 bytes like PlusPagos AESEncrypter', () => {
    const key = normalizeMacroClickAesKey('short');
    expect(key.length).toBe(32);
    expect(key.toString('utf8')).toBe('shortshortshortshortshortshortsh');
  });

  it('round-trips AES-256-CBC with IV prefix', () => {
    const secret = 'prueba_7f3a9253-c83a-4d68-b151-6e2fb1e10463';
    const plain = 'https://www.sanovacapital.com/ok';
    const enc = encryptMacroClickString(plain, secret);
    expect(enc).not.toContain(plain);
    expect(decryptMacroClickString(enc, secret)).toBe(plain);
  });

  it('formats amount as cents without separators', () => {
    expect(formatMacroClickAmountCents(943)).toBe('94300');
    expect(formatMacroClickAmountCents(4)).toBe('400');
    expect(formatMacroClickAmountCents(3789)).toBe('378900');
  });

  it('builds SHA256Firm hash ip*guid*sucursal*monto*secret', () => {
    const hash = buildMacroClickHash({
      clientIp: '1.2.3.4',
      secretKey: 'secret',
      commerceGuid: 'guid',
      branchId: '',
      amountCents: '10000'
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(
      buildMacroClickHash({
        clientIp: '1.2.3.4',
        secretKey: 'secret',
        commerceGuid: 'guid',
        branchId: '',
        amountCents: '10000'
      })
    );
  });
});
