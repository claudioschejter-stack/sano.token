#!/usr/bin/env node
/**
 * Verifica en producción (runtime Vercel) que la pasarela mínima esté activa.
 * Usa `vercel env run --environment=production` para inyectar secrets.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const web = join(root, 'apps/web');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const result = spawnSync(
  npx,
  ['vercel', 'env', 'run', '--environment=production', '--', 'node', join(root, 'scripts/vercel/check-payments-env.mjs')],
  {
    cwd: web,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://sano-token-web.vercel.app'
    }
  }
);

process.exit(result.status ?? 1);
