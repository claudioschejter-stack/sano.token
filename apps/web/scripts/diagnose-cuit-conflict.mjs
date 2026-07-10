/**
 * Diagnose a "DOCUMENT_ALREADY_REGISTERED" conflict for one or more emails.
 * Read-only: prints the User rows for the given emails plus the Investor row(s)
 * tied to their kycDocumentId/cuit, so we can see which account actually owns
 * the document and why the other one is being blocked.
 *
 * Run from apps/web:
 *   node scripts/diagnose-cuit-conflict.mjs claudioschejter@hotmail.com claudiochejter@hotmail.com
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

const args = process.argv.slice(2);
const cuitFlagIndex = args.indexOf('--cuit');
const cuit = cuitFlagIndex !== -1 ? args[cuitFlagIndex + 1] : null;
const emails = args.filter((a, i) => a !== '--cuit' && i !== cuitFlagIndex + 1).map((e) => e.trim().toLowerCase());

const prisma = new PrismaClient();

if (cuit) {
  const usersByDoc = await prisma.user.findMany({
    where: { kycDocumentId: cuit },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      accountStatus: true,
      kycStatus: true,
      investorId: true,
      walletAddress: true,
      createdAt: true,
      registrationChannel: true
    }
  });
  console.log(`\n=== All User rows with kycDocumentId = ${cuit} ===`);
  console.log(usersByDoc);
}

for (const email of emails) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      accountStatus: true,
      kycStatus: true,
      kycDocumentId: true,
      kycFullName: true,
      investorId: true,
      walletAddress: true,
      createdAt: true
    }
  });

  console.log('\n=== User:', email, '===');
  console.log(user ?? 'NOT FOUND');

  if (user?.investorId) {
    const investor = await prisma.investor.findUnique({
      where: { id: user.investorId },
      select: { id: true, email: true, cuit: true, fullName: true, walletAddress: true, kycStatus: true }
    });
    console.log('Linked Investor (via investorId):', investor);
  }

  if (user?.kycDocumentId) {
    const investorByCuit = await prisma.investor.findUnique({
      where: { cuit: user.kycDocumentId },
      select: { id: true, email: true, cuit: true, fullName: true, walletAddress: true, kycStatus: true }
    });
    console.log('Investor row matching this kycDocumentId as cuit:', investorByCuit);

    if (investorByCuit) {
      const owners = await prisma.user.findMany({
        where: { investorId: investorByCuit.id },
        select: { id: true, email: true, accountStatus: true, kycStatus: true, createdAt: true }
      });
      console.log('User(s) that own that Investor row:', owners);
    }
  }
}

await prisma.$disconnect();
