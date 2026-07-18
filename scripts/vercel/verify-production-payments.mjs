#!/usr/bin/env node
/**
 * Verifica en producción (runtime Vercel) que la pasarela mínima esté activa.
 * Usa `vercel env run --environment=production` para inyectar secrets.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const web = join(root, 'apps/web');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Relative path from apps/web — avoids Windows breakage when the absolute path has spaces.
const checkScriptRel = relative(web, join(root, 'scripts/vercel/check-payments-env.mjs')).replace(
  /\\/g,
  '/'
);
const result = spawnSync(
  npx,
  ['vercel', 'env', 'run', '--environment=production', '--', 'node', checkScriptRel],
  {
    cwd: web,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://sanovacapital.com'
    }
  }
);

process.exit(result.status ?? 1);
