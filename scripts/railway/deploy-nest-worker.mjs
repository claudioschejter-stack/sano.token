#!/usr/bin/env node
/**
 * One-shot Nest worker deploy on Railway + sync NEXT_PUBLIC_API_URL to Vercel.
 * Prereqs: `npx @railway/cli login` and project linked (or RAILWAY_PROJECT_ID set).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID ?? 'a5014ffc-130f-4d2f-9c7b-84fd651d9f55';
const ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID ?? 'bb37162b-725f-40a2-885d-9ac18fb6dfbc';
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID ?? '8d5680aa-768f-45ff-9c50-f61363a0578a';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    ...opts
  });
  return result;
}

function mustOk(label, result) {
  if (result.status !== 0) {
    console.error(`\n[FAIL] ${label}`);
    console.error((result.stderr || result.stdout || '').slice(0, 800));
    process.exit(1);
  }
  return result.stdout?.trim() ?? '';
}

console.log('=== Deploy Nest worker (Railway) ===\n');

let whoami = run('npx', ['@railway/cli', 'whoami']);
if (whoami.status !== 0) {
  console.error('Railway CLI not logged in. Run: npx @railway/cli login --browserless');
  process.exit(1);
}
console.log(`Railway user: ${whoami.stdout?.trim()}`);

console.log('\n1) Link project…');
mustOk(
  'railway link',
  run('npx', ['@railway/cli', 'link', '-p', PROJECT_ID, '-e', ENVIRONMENT_ID, '-s', SERVICE_ID])
);

console.log('\n2) Pull Vercel production env (for DATABASE_URL, secrets)…');
run('npx', ['vercel', 'env', 'pull', '.env.railway', '--environment=production', '--yes']);

console.log('\n3) Sync env vars to Railway…');
mustOk('railway:sync-nest-env', run('npm', ['run', 'railway:sync-nest-env']));

console.log('\n4) Deploy (Dockerfile.api)…');
mustOk('railway up', run('npx', ['@railway/cli', 'up', '--detach']));

console.log('\n5) Generate public domain…');
const domainResult = run('npx', ['@railway/cli', 'domain']);
let domain = '';
if (domainResult.status === 0) {
  const match = (domainResult.stdout || '').match(/https?:\/\/[^\s]+/);
  domain = match ? match[0].replace(/\/$/, '') : '';
}
if (!domain) {
  console.log('No domain yet — run: npx @railway/cli domain');
  process.exit(0);
}
console.log(`Public URL: ${domain}`);

const envPath = join(root, '.env');
const line = `NEXT_PUBLIC_API_URL="${domain}"\n`;
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf8');
  if (/^NEXT_PUBLIC_API_URL=/m.test(raw)) {
    writeFileSync(
      envPath,
      raw.replace(/^NEXT_PUBLIC_API_URL=.*$/m, `NEXT_PUBLIC_API_URL="${domain}"`)
    );
  } else {
    appendFileSync(envPath, `\n${line}`);
  }
} else {
  writeFileSync(envPath, line);
}

console.log('\n6) Sync NEXT_PUBLIC_API_URL → Vercel…');
mustOk('vercel:sync-nest-api-url', run('npm', ['run', 'vercel:sync-nest-api-url']));

console.log('\n7) Redeploy Vercel web…');
mustOk('vercel deploy', run('npx', ['vercel', '--prod', '--yes']));

console.log('\nDone. Verify:');
console.log(`  curl ${domain}/api/v1/health`);
console.log(`  https://sano-token-web.vercel.app (SSE /api/v1/finance/stream)`);
