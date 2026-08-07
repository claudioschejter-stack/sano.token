import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const BCRYPT_ROUNDS = 10;
const BACKUP_CODE_COUNT = 8;
const MAX_2FA_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos
const TEMP_TOKEN_TTL = '10m';
const TOTP_ISSUER = process.env.TOTP_ISSUER?.trim() || 'Sanova Capital';

function getEncryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 32) {
    throw new Error('TOTP_ENCRYPTION_KEY no configurada (debe tener al menos 32 bytes)');
  }
  return Buffer.from(raw.slice(0, 64), 'hex').subarray(0, 32);
}

function getTempTokenSecret(): Uint8Array {
  const secret =
    process.env.AUTH_INTERNAL_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET no configurado');
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Encriptación AES-256-GCM del secret TOTP
// ---------------------------------------------------------------------------

export function encryptTotpSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato: iv(24 hex) + tag(32 hex) + ciphertext(hex)
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

export function decryptTotpSecret(stored: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(stored.slice(0, 24), 'hex');
  const tag = Buffer.from(stored.slice(24, 56), 'hex');
  const ciphertext = Buffer.from(stored.slice(56), 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return normalizeTotpSecret(
    Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  );
}

export function normalizeTotpSecret(secret: string): string {
  return secret.replace(/\s+/g, '').toUpperCase();
}

// ---------------------------------------------------------------------------
// TOTP — generación y verificación
// ---------------------------------------------------------------------------

export function generateTotpSecret(): string {
  return authenticator.generateSecret(20);
}

export function getTotpUri(secret: string, email: string): string {
  return authenticator.keyuri(email, TOTP_ISSUER, secret);
}

/**
 * Whether this submission is the current code.
 *
 * The shape check lives here rather than at the call site on purpose: when the
 * caller decides whether to verify based on what the code looks like, the
 * request controls whether the check runs at all. Anything that is not six
 * digits is simply not the code, which is an answer this function can give.
 */
export function verifyTotpCode(secret: string, token: string | null | undefined): boolean {
  const submitted = (token ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(submitted)) {
    return false;
  }

  // Allow ±2 steps (~60s) for phone clock drift during mobile onboarding.
  authenticator.options = { window: 2 };
  return authenticator.check(submitted, normalizeTotpSecret(secret));
}

// ---------------------------------------------------------------------------
// Backup codes
// ---------------------------------------------------------------------------

export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw = randomBytes(5).toString('hex').toUpperCase();
    // Formato legible: XXXXX-XXXXX
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code.replace('-', '').toUpperCase(), BCRYPT_ROUNDS)));
}

/**
 * Index of the matching backup code, or -1.
 *
 * Same reasoning as `verifyTotpCode`: an empty or malformed submission is not a
 * match, decided here instead of by a branch around the call. Bailing out before
 * the bcrypt comparisons also keeps an empty body from costing one hash per
 * stored code on every failed login.
 */
export async function verifyBackupCode(
  rawCode: string | null | undefined,
  hashes: string[]
): Promise<number> {
  const normalized = (rawCode ?? '').replace('-', '').replace(/\s/g, '').toUpperCase();
  if (normalized.length < 5) {
    return -1;
  }

  for (let i = 0; i < hashes.length; i++) {
    const match = await bcrypt.compare(normalized, hashes[i]);
    if (match) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Token temporal 2FA (válido 10 min, entre step1 y step2 del login)
// ---------------------------------------------------------------------------

export async function issueTempTotpToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, purpose: 'totp-verify' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TEMP_TOKEN_TTL)
    .sign(getTempTokenSecret());
}

export async function verifyTempTotpToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getTempTokenSecret());
    if (payload.purpose !== 'totp-verify' || typeof payload.sub !== 'string') {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting 2FA
// ---------------------------------------------------------------------------

export function is2faLocked(user: { locked2faUntil: Date | null }): boolean {
  if (!user.locked2faUntil) return false;
  return user.locked2faUntil > new Date();
}

export function lockoutRemainingSeconds(user: { locked2faUntil: Date | null }): number {
  if (!user.locked2faUntil) return 0;
  return Math.max(0, Math.ceil((user.locked2faUntil.getTime() - Date.now()) / 1000));
}

export function shouldLock(failedAttempts: number): boolean {
  return failedAttempts >= MAX_2FA_ATTEMPTS;
}

export function lockUntilDate(): Date {
  return new Date(Date.now() + LOCK_DURATION_MS);
}

export { MAX_2FA_ATTEMPTS };
