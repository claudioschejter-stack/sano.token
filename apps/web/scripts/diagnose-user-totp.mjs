/**
 * Diagnose TOTP for one user. Run from apps/web:
 *   node scripts/diagnose-user-totp.mjs claudioschejter@hotmail.com
 */
import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import { createDecipheriv, createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '../..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(repoRoot, '.env'));
loadEnvFile(resolve(appRoot, '.env.local'));
loadEnvFile(resolve(appRoot, '.env.vercel.prod'));

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKeyLegacy(raw) {
  return Buffer.from(raw.slice(0, 64), 'hex').subarray(0, 32);
}

function getEncryptionKeySha(raw) {
  return createHash('sha256').update(raw, 'utf8').digest();
}

function decrypt(stored, key) {
  const iv = Buffer.from(stored.slice(0, 24), 'hex');
  const tag = Buffer.from(stored.slice(24, 56), 'hex');
  const ciphertext = Buffer.from(stored.slice(56), 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/diagnose-user-totp.mjs <email>');
  process.exit(1);
}

const rawKey = process.env.TOTP_ENCRYPTION_KEY?.trim();
if (!rawKey) {
  console.error('TOTP_ENCRYPTION_KEY missing in env');
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({
  where: { email },
  select: { totpSecret: true, totpEnabled: true, accountStatus: true }
});

if (!user?.totpSecret) {
  console.log({ email, totpSecret: null, totpEnabled: user?.totpEnabled, accountStatus: user?.accountStatus });
  await prisma.$disconnect();
  process.exit(0);
}

console.log('Key length:', rawKey.length, 'hex-valid:', /^[0-9a-fA-F]+$/.test(rawKey));

for (const label of ['legacy-hex', 'sha256']) {
  try {
    const key = label === 'legacy-hex' ? getEncryptionKeyLegacy(rawKey) : getEncryptionKeySha(rawKey);
    const secret = decrypt(user.totpSecret, key).replace(/\s+/g, '').toUpperCase();
    authenticator.options = { window: 2 };
    const token = authenticator.generate(secret);
    console.log(label, {
      keyBytes: key.length,
      secretPreview: `${secret.slice(0, 4)}…${secret.slice(-4)}`,
      serverToken: token,
      selfCheck: authenticator.check(token, secret)
    });
  } catch (error) {
    console.log(label, 'FAIL', error.message);
  }
}

console.log({ totpEnabled: user.totpEnabled, accountStatus: user.accountStatus });
await prisma.$disconnect();
