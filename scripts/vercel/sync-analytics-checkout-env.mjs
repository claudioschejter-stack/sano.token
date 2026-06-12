#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const entries = {
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'sanovacapital.com',
  NEXT_PUBLIC_API_URL: 'https://sanovaapi-production.up.railway.app',
  NEXT_PUBLIC_TOKEN_TREASURY_ADDRESS: '0x5e7480c43f99cBCc90550a16356C90793c300d52'
};

function addEnv(name, value, environments = ['production']) {
  for (const target of environments) {
    const result = spawnSync(
      npxCmd,
      ['vercel', 'env', 'add', name, target, '--value', value, '--force', '--yes'],
      { cwd: root, encoding: 'utf8', timeout: 120000 }
    );
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}:`, (result.stderr || result.stdout || '').slice(0, 400));
      return false;
    }
    console.log(`ok ${name}@${target}`);
  }
  return true;
}

console.log('=== Sync Vercel analytics + checkout env ===\n');
let ok = true;
for (const [name, value] of Object.entries(entries)) {
  if (!addEnv(name, value)) {
    ok = false;
  }
}

if (!ok) {
  process.exit(1);
}

console.log('\n=== Trigger production redeploy ===');
const deploy = spawnSync(npxCmd, ['vercel', 'deploy', '--prod', '--yes'], {
  cwd: join(root, 'apps/web'),
  encoding: 'utf8',
  timeout: 600000
});

if (deploy.status !== 0) {
  console.error((deploy.stderr || deploy.stdout || '').slice(-800));
  process.exit(1);
}

console.log((deploy.stdout || '').split('\n').slice(-5).join('\n'));
console.log('Done.');
