import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * PlusPagos / Click de Pago AES-256-CBC (AESEncrypter.encryptString):
 * - Expand SecretKey by repetition until length ≥ 32, then take first 32 UTF-8 bytes.
 * - Encrypt with random IV; return Base64(IV || ciphertext).
 */
export function normalizeMacroClickAesKey(secretKey: string): Buffer {
  let phrase = secretKey ?? '';
  if (!phrase) {
    throw new Error('MACRO_CLICK_SECRET_KEY_MISSING');
  }
  while (phrase.length < 32) {
    phrase += phrase;
  }
  return Buffer.from(phrase.slice(0, 32), 'utf8');
}

export function encryptMacroClickString(plainText: string, secretKey: string): string {
  const key = normalizeMacroClickAesKey(secretKey);
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plainText, 'utf8')), cipher.final()]);
  return Buffer.concat([iv, encrypted]).toString('base64');
}

export function decryptMacroClickString(cipherTextB64: string, secretKey: string): string {
  const key = normalizeMacroClickAesKey(secretKey);
  const combined = Buffer.from(cipherTextB64, 'base64');
  const iv = combined.subarray(0, 16);
  const data = combined.subarray(16);
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * PlusPagos SHA256Firm.getFirm:
 * SHA256(ip + "*" + guidComercio + "*" + sucursalId + "*" + monto + "*" + secretKey) lowercase hex.
 */
export function buildMacroClickHash(input: {
  clientIp: string;
  secretKey: string;
  commerceGuid: string;
  branchId: string;
  amountCents: string;
}): string {
  const payload = [
    input.clientIp.trim(),
    input.commerceGuid.trim(),
    (input.branchId ?? '').trim(),
    String(input.amountCents).trim(),
    input.secretKey.trim()
  ].join('*');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/** Macro MONTO: cents as integer string without separators ($943.00 → "94300"). */
export function formatMacroClickAmountCents(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('INVALID_MACRO_CLICK_AMOUNT');
  }
  return String(Math.round(amount * 100));
}
