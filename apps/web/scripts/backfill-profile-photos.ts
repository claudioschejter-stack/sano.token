/**
 * Backfill KYC-derived profile photos for already-approved investors whose
 * account predates (or was otherwise missed by) the automatic
 * portrait/selfie -> avatar pipeline in `persistDiditMedia`.
 *
 * For each target user this:
 *   1. Re-fetches the Didit decision for their session (retrieveDiditDecision).
 *   2. Ensures a KycVerification row exists for that session (older accounts
 *      created before that table existed only have `User.diditSessionId`).
 *   3. Re-runs persistDiditMedia so the portrait/selfie is downloaded and
 *      uploaded to Supabase storage, and User.image/kycPortraitPath are set.
 *
 * Run from apps/web (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and
 * DIDIT_API_KEY to be configured in the environment actually used):
 *   npx tsx scripts/backfill-profile-photos.ts claudioschejter@hotmail.com
 *   npx tsx scripts/backfill-profile-photos.ts --all-approved-missing-photo
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '@sanova/database';
import { retrieveDiditDecision } from '../src/lib/onboarding/diditService';
import { persistDiditMedia } from '../src/lib/onboarding/diditMedia';
import { isSupabaseStorageConfigured } from '../src/lib/storage/supabaseAdmin';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '../..');

function loadEnvFile(path: string) {
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

async function ensureKycVerification(input: {
  userId: string;
  sessionId: string;
  kycStatus: 'APPROVED' | 'REJECTED' | 'PENDING';
  decisionPayload: Record<string, unknown>;
}) {
  const existing = await prisma.kycVerification.findUnique({
    where: { userId_sessionId: { userId: input.userId, sessionId: input.sessionId } }
  });

  if (existing) {
    return existing;
  }

  return prisma.kycVerification.create({
    data: {
      userId: input.userId,
      provider: 'DIDIT',
      sessionId: input.sessionId,
      status: input.kycStatus,
      rawDecisionPayload: input.decisionPayload,
      approvedAt: input.kycStatus === 'APPROVED' ? new Date() : null
    }
  });
}

async function backfillOne(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      image: true,
      kycPortraitPath: true,
      kycStatus: true,
      diditSessionId: true
    }
  });

  if (!user) {
    console.log(`[skip] ${email}: no user found`);
    return;
  }

  if (user.kycStatus !== 'APPROVED') {
    console.log(`[skip] ${email}: kycStatus is ${user.kycStatus}, not APPROVED`);
    return;
  }

  if (!user.diditSessionId) {
    console.log(`[skip] ${email}: no diditSessionId on record, nothing to re-fetch`);
    return;
  }

  if (user.image) {
    console.log(`[skip] ${email}: already has a profile photo (User.image set)`);
    return;
  }

  console.log(`[run] ${email}: fetching Didit decision for session ${user.diditSessionId}`);
  let decision: Record<string, unknown>;
  try {
    decision = await retrieveDiditDecision(user.diditSessionId);
  } catch (error) {
    console.error(`[fail] ${email}: retrieveDiditDecision failed`, error instanceof Error ? error.message : error);
    return;
  }

  const verification = await ensureKycVerification({
    userId: user.id,
    sessionId: user.diditSessionId,
    kycStatus: 'APPROVED',
    decisionPayload: decision
  });

  const result = await persistDiditMedia({
    userId: user.id,
    kycVerificationId: verification.id,
    payload: decision
  });

  console.log(`[done] ${email}:`, result);
}

async function main() {
  if (!isSupabaseStorageConfigured()) {
    console.error(
      'Supabase storage is not configured in this environment (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing). Aborting — nothing would be uploaded.'
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.includes('--all-approved-missing-photo')) {
    const candidates = await prisma.user.findMany({
      where: { kycStatus: 'APPROVED', image: null, diditSessionId: { not: null } },
      select: { email: true }
    });
    console.log(`Found ${candidates.length} approved user(s) missing a photo.`);
    for (const candidate of candidates) {
      await backfillOne(candidate.email);
    }
  } else {
    const emails = args.filter((arg) => !arg.startsWith('--'));
    if (emails.length === 0) {
      console.error('Usage: npx tsx scripts/backfill-profile-photos.ts <email> [<email> ...]');
      console.error('   or: npx tsx scripts/backfill-profile-photos.ts --all-approved-missing-photo');
      process.exit(1);
    }
    for (const email of emails) {
      await backfillOne(email);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
