/**
 * Bridge ops helper: validate API key, list/create webhook endpoint.
 * Usage:
 *   node scripts/bridge-setup.mjs check
 *   node scripts/bridge-setup.mjs ensure-webhook https://sanovacapital.com/api/webhooks/bridge
 *
 * Loads apps/web/.env.local (BRIDGE_API_KEY). Does not print secrets.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BRIDGE_API_BASE = 'https://api.bridge.xyz/v0';

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function bridgeFetch(pathname, apiKey, options = {}) {
  const res = await fetch(`${BRIDGE_API_BASE}${pathname}`, {
    ...options,
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, body };
}

async function check(apiKey) {
  const customers = await bridgeFetch('/customers?limit=1', apiKey);
  console.log('customers.list', customers.status, customers.ok ? 'OK' : 'FAIL');
  if (!customers.ok) {
    console.log(JSON.stringify(customers.body)?.slice(0, 400));
    process.exitCode = 1;
    return;
  }

  const webhooks = await bridgeFetch('/webhooks', apiKey);
  console.log('webhooks.list', webhooks.status, webhooks.ok ? 'OK' : 'FAIL');
  if (webhooks.ok) {
    const rows = Array.isArray(webhooks.body)
      ? webhooks.body
      : webhooks.body?.data ?? [];
    for (const row of rows) {
      console.log(
        `- webhook ${row.id} status=${row.status} url=${row.url} public_key=${row.public_key ? 'yes' : 'no'}`
      );
    }
  } else {
    console.log(JSON.stringify(webhooks.body)?.slice(0, 400));
  }
}

async function ensureWebhook(apiKey, url) {
  const listed = await bridgeFetch('/webhooks', apiKey);
  if (!listed.ok) {
    console.error('Cannot list webhooks', listed.status, JSON.stringify(listed.body)?.slice(0, 400));
    process.exitCode = 1;
    return;
  }

  const rows = Array.isArray(listed.body) ? listed.body : listed.body?.data ?? [];
  const existing = rows.find((row) => String(row.url || '').replace(/\/$/, '') === url.replace(/\/$/, ''));
  if (existing) {
    console.log('Webhook already exists', existing.id, existing.status);
    if (existing.public_key) {
      console.log('PUBLIC_KEY_PEM_START');
      console.log(existing.public_key);
      console.log('PUBLIC_KEY_PEM_END');
    }
    if (existing.status === 'disabled') {
      const enabled = await bridgeFetch(`/webhooks/${existing.id}`, apiKey, {
        method: 'PUT',
        body: JSON.stringify({ status: 'active' })
      });
      console.log('enable', enabled.status, enabled.ok ? 'OK' : JSON.stringify(enabled.body)?.slice(0, 300));
    }
    return;
  }

  const idempotencyKey = `sanova-webhook-${crypto.createHash('sha256').update(url).digest('hex').slice(0, 16)}`;
  const created = await bridgeFetch('/webhooks', apiKey, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({
      url,
      event_epoch: 'webhook_creation',
      event_categories: ['customer', 'kyc_link', 'transfer', 'virtual_account']
    })
  });

  console.log('create', created.status, created.ok ? 'OK' : 'FAIL');
  if (!created.ok) {
    console.log(JSON.stringify(created.body)?.slice(0, 600));
    process.exitCode = 1;
    return;
  }

  console.log('Created webhook', created.body?.id, created.body?.status);
  if (created.body?.public_key) {
    console.log('PUBLIC_KEY_PEM_START');
    console.log(created.body.public_key);
    console.log('PUBLIC_KEY_PEM_END');
  }

  if (created.body?.id && created.body?.status === 'disabled') {
    const enabled = await bridgeFetch(`/webhooks/${created.body.id}`, apiKey, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active' })
    });
    console.log('enable', enabled.status, enabled.ok ? 'OK' : JSON.stringify(enabled.body)?.slice(0, 300));
  }
}

loadEnvLocal();
const apiKey = process.env.BRIDGE_API_KEY?.trim();
if (!apiKey) {
  console.error('BRIDGE_API_KEY missing (set in .env.local or env)');
  process.exit(1);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'check') {
  await check(apiKey);
} else if (cmd === 'ensure-webhook') {
  if (!arg) {
    console.error('Usage: node scripts/bridge-setup.mjs ensure-webhook <https-url>');
    process.exit(1);
  }
  await ensureWebhook(apiKey, arg);
} else {
  console.error('Usage: node scripts/bridge-setup.mjs check|ensure-webhook <url>');
  process.exit(1);
}
