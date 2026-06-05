import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(root, 'apps/web');
const envPath = resolve(web, '.env.local');

if (!existsSync(envPath)) {
  console.error('Missing apps/web/.env.local');
  process.exit(1);
}

const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) continue;
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  env[trimmed.slice(0, eq).trim()] = value;
}

const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'];

for (const key of keys) {
  const value = env[key] || (key === 'SUPABASE_SERVICE_ROLE_KEY' ? env.SUPABASE_KEY : undefined);
  if (!value?.trim()) {
    console.log(`[skip] ${key}`);
    continue;
  }

  console.log(`[set] ${key}`);
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    npx,
    ['vercel', 'env', 'add', key, 'production', '--force', '--yes'],
    {
      cwd: web,
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: process.env,
      shell: process.platform === 'win32'
    }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Done.');
