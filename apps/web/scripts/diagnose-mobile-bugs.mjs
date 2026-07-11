/**
 * Diagnose PWA install-gate + avatar state for one user. Run from apps/web:
 *   node scripts/diagnose-mobile-bugs.mjs claudioschejter@hotmail.com
 */
import { PrismaClient } from '@prisma/client';
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

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/diagnose-mobile-bugs.mjs <email>');
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({
  where: { email },
  select: {
    id: true,
    email: true,
    name: true,
    image: true,
    kycPortraitPath: true,
    kycStatus: true,
    accountStatus: true,
    pwaInstalledAt: true,
    pwaDismissedAt: true,
    totpEnabled: true,
    investorId: true,
    passkeys: { select: { id: true, deviceName: true, createdAt: true } }
  }
});

if (!user) {
  console.log('No user found for', email);
  await prisma.$disconnect();
  process.exit(0);
}

console.log(JSON.stringify(user, null, 2));

if (user.investorId) {
  const investor = await prisma.investor.findUnique({
    where: { id: user.investorId },
    select: { id: true, portraitPath: true, kycStatus: true }
  });
  console.log('Investor:', JSON.stringify(investor, null, 2));
}

const verifications = await prisma.kycVerification.findMany({
  where: { userId: user.id },
  select: { id: true, status: true, createdAt: true, sessionId: true },
  orderBy: { createdAt: 'desc' }
});
console.log('KycVerifications:', JSON.stringify(verifications, null, 2));

const documents = await prisma.kycDocument.findMany({
  where: { kycVerificationId: { in: verifications.map((v) => v.id) } },
  select: { kind: true, storageBucket: true, storagePath: true, createdAt: true }
});
console.log('KycDocuments:', JSON.stringify(documents, null, 2));

await prisma.$disconnect();
