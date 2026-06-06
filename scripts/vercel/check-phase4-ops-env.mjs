#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

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

const env = {
  ...parseEnvFile(join(root, '.env')),
  ...parseEnvFile(join(root, 'apps/web/.env.local'))
};

const blockchainRpc =
  env.BLOCKCHAIN_RPC_URL?.trim() ||
  env.LENDING_BASE_RPC_URL?.trim() ||
  env.BASE_RPC_URL?.trim() ||
  '';

const items = [
  { key: 'BLOCKCHAIN_LISTENER_ENABLED', label: 'Nest listener habilitado', defaultValue: 'true' },
  { key: 'BLOCKCHAIN_WRITES_ENABLED', label: 'Writes on-chain (Next)', defaultValue: 'true' },
  { key: 'BLOCKCHAIN_RPC_URL', label: 'RPC unificado', value: blockchainRpc },
  { key: 'AUTOMATION_SLACK_WEBHOOK_URL', label: 'Slack alertas automation', optional: true },
  { key: 'SENTRY_DSN', label: 'Sentry server', optional: true },
  { key: 'NEXT_PUBLIC_SENTRY_DSN', label: 'Sentry client', optional: true }
];

console.log('=== Phase 4 ops — checklist local (.env) ===\n');

let coreReady = true;
for (const item of items) {
  const value = item.value ?? env[item.key]?.trim() ?? item.defaultValue ?? '';
  const ok = Boolean(value);
  if (!item.optional && !ok) coreReady = false;
  const display =
    item.key.includes('SECRET') || item.key.includes('WEBHOOK') || item.key.includes('DSN')
      ? ok
        ? '(configurado)'
        : '(vacío)'
      : value || '(vacío)';
  console.log(`${ok || item.optional ? '✓' : '✗'} ${item.label}`);
  console.log(`    ${item.key} = ${display}`);
}

console.log('\n--- Notas ---');
console.log('• BLOCKCHAIN_RPC_URL en Vercel web: usado por crons/automation Next.');
console.log('• Nest listener (SSE dividendos): requiere API always-on + mismas vars en ese servicio.');
console.log('• Slack/Sentry son opcionales; email usa AUTH_ADMIN_EMAILS.');

process.exit(coreReady ? 0 : 1);
