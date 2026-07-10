/**
 * Safely delete a single orphaned User row by email (cascades to
 * KycVerification/Notification/UserPasskey/BackupCode/etc via Prisma FKs).
 * Refuses to run if the user already owns a real Investor profile.
 *
 * Run from apps/web:
 *   node scripts/delete-orphan-user.mjs ventas@sanovacapital.com
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
  console.error('Usage: node scripts/delete-orphan-user.mjs <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, investorId: true, walletAddress: true, accountStatus: true, systemRole: true }
});

if (!user) {
  console.log('No user found for', email, '- nothing to delete.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log('About to delete:', user);

if (user.investorId || user.walletAddress || user.systemRole !== 'INVESTOR') {
  console.error('REFUSING to delete: this user has an investorId, walletAddress, or non-investor role. Aborting.');
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.user.delete({ where: { id: user.id } });
console.log('Deleted user', email, '(id:', user.id, ')');

await prisma.$disconnect();
