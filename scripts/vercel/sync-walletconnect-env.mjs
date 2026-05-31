#!/usr/bin/env node
/**
 * Sync NEXT_PUBLIC_WC_PROJECT_ID to Vercel (Production + Preview).
 * Usage: npm run vercel:sync-walletconnect
 *        WC_PROJECT_ID=abc123 npm run vercel:sync-walletconnect
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ENV_KEY = 'NEXT_PUBLIC_WC_PROJECT_ID';

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fromFiles = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, '.env.local')),
  ...parseEnvFile(join(root, 'apps/web/.env.local'))
};

const projectId =
  process.env.WC_PROJECT_ID?.trim() ||
  process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim() ||
  fromFiles.NEXT_PUBLIC_WC_PROJECT_ID?.trim() ||
  '';

if (!projectId) {
  console.error(`Missing ${ENV_KEY}.`);
  console.error('');
  console.error('1. Create a project at https://cloud.reown.com');
  console.error('2. Copy the Project ID');
  console.error('3. Add allowed domains: sano-token-web.vercel.app, localhost:3000');
  console.error('4. Set in .env: NEXT_PUBLIC_WC_PROJECT_ID="your-id"');
  console.error('   Or run: WC_PROJECT_ID=your-id npm run vercel:sync-walletconnect');
  process.exit(1);
}

function addEnv(name, value, environments) {
  for (const target of environments) {
    const result = spawnSync('npx', ['vercel', 'env', 'add', name, target, '--force'], {
      cwd: root,
      input: `${value}\n`,
      encoding: 'utf8',
      shell: true
    });
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}:`, result.stderr?.slice(0, 300) || result.stdout?.slice(0, 300));
      process.exit(1);
    }
    console.log(`ok ${name}@${target}`);
  }
}

console.log(`Syncing WalletConnect (${ENV_KEY}) to Vercel…`);
addEnv(ENV_KEY, projectId, ['production', 'preview']);
console.log('Done. Redeploy production: npx vercel --prod');
