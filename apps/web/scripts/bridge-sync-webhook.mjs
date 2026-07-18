/**
 * Fix Bridge webhook delivery: canonical URL (no apex redirect) + public key sync hint.
 *
 * Usage:
 *   node scripts/bridge-sync-webhook.mjs check
 *   node scripts/bridge-sync-webhook.mjs fix
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BRIDGE_API_BASE = 'https://api.bridge.xyz/v0';
const CANONICAL_WEBHOOK_URL = 'https://www.sanovacapital.com/api/webhooks/bridge';
const WEBHOOK_ID = 'wep_t9cYbgFGrR9CiGYEA52Hfgs';

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

function normalizeUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/$/, '')
    .toLowerCase();
}

function readEnvPublicKey() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return '';
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('BRIDGE_WEBHOOK_PUBLIC_KEY=')) continue;
    let value = line.slice('BRIDGE_WEBHOOK_PUBLIC_KEY='.length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value.replace(/\\n/g, '\n').trim();
  }
  return '';
}

function keysMatch(a, b) {
  return a.replace(/\s/g, '') === b.replace(/\s/g, '');
}

async function getWebhook(apiKey) {
  const listed = await bridgeFetch('/webhooks', apiKey);
  if (!listed.ok) {
    console.error('Cannot list webhooks', listed.status, JSON.stringify(listed.body)?.slice(0, 400));
    process.exitCode = 1;
    return null;
  }
  const rows = Array.isArray(listed.body) ? listed.body : listed.body?.data ?? [];
  return rows.find((row) => row.id === WEBHOOK_ID) ?? rows[0] ?? null;
}

async function check(apiKey) {
  const wh = await getWebhook(apiKey);
  if (!wh) return;

  const envKey = readEnvPublicKey();
  const urlOk = normalizeUrl(wh.url) === normalizeUrl(CANONICAL_WEBHOOK_URL);
  const keyOk = envKey ? keysMatch(envKey, wh.public_key || '') : false;

  console.log('webhook.id', wh.id);
  console.log('webhook.status', wh.status);
  console.log('webhook.url', wh.url);
  console.log('canonical.url', CANONICAL_WEBHOOK_URL);
  console.log('url_ok', urlOk ? 'YES' : 'NO — apex redirect breaks Bridge POST');
  console.log('env_public_key_present', envKey ? 'yes' : 'no');
  console.log('env_public_key_matches_bridge', keyOk ? 'YES' : 'NO — run npm run vercel:configure-payments after fix');

  if (!urlOk || !keyOk) {
    process.exitCode = 1;
  }
}

async function fix(apiKey) {
  let wh = await getWebhook(apiKey);
  if (!wh) return;

  const needsUrl = normalizeUrl(wh.url) !== normalizeUrl(CANONICAL_WEBHOOK_URL);
  const needsEnable = wh.status !== 'active';

  if (needsUrl) {
    // Bridge rejects URL changes on active endpoints — disable first.
    if (wh.status === 'active') {
      const disabled = await bridgeFetch(`/webhooks/${wh.id}`, apiKey, {
        method: 'PUT',
        body: JSON.stringify({ status: 'disabled' })
      });
      console.log('disable', disabled.status, disabled.ok ? 'OK' : 'FAIL');
      if (!disabled.ok) {
        console.log(JSON.stringify(disabled.body)?.slice(0, 600));
        process.exitCode = 1;
        return;
      }
    }

    const updated = await bridgeFetch(`/webhooks/${wh.id}`, apiKey, {
      method: 'PUT',
      body: JSON.stringify({
        url: CANONICAL_WEBHOOK_URL,
        status: 'active',
        event_categories: ['customer', 'kyc_link', 'transfer', 'virtual_account']
      })
    });
    console.log('update', updated.status, updated.ok ? 'OK' : 'FAIL');
    if (!updated.ok) {
      console.log(JSON.stringify(updated.body)?.slice(0, 600));
      process.exitCode = 1;
      return;
    }
    wh = { ...wh, ...updated.body };
  } else if (needsEnable) {
    const enabled = await bridgeFetch(`/webhooks/${wh.id}`, apiKey, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active' })
    });
    console.log('enable', enabled.status, enabled.ok ? 'OK' : 'FAIL');
    if (!enabled.ok) {
      console.log(JSON.stringify(enabled.body)?.slice(0, 600));
      process.exitCode = 1;
      return;
    }
    wh = { ...wh, ...enabled.body };
  } else {
    console.log('webhook URL already canonical');
  }

  console.log('\nSet in Vercel Production (then redeploy):');
  console.log('BRIDGE_WEBHOOK_PUBLIC_KEY=');
  console.log(wh.public_key ?? '');

  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath) && wh.public_key) {
    let content = fs.readFileSync(envPath, 'utf8');
    const escaped = wh.public_key.replace(/\n/g, '\\n');
    if (/^BRIDGE_WEBHOOK_PUBLIC_KEY=/m.test(content)) {
      content = content.replace(/^BRIDGE_WEBHOOK_PUBLIC_KEY=.*$/m, `BRIDGE_WEBHOOK_PUBLIC_KEY="${escaped}"`);
    } else {
      content += `\nBRIDGE_WEBHOOK_PUBLIC_KEY="${escaped}"\n`;
    }
    fs.writeFileSync(envPath, content);
    console.log('\nUpdated apps/web/.env.local BRIDGE_WEBHOOK_PUBLIC_KEY');
  }

  console.log('\nNext:');
  console.log('  npm run vercel:configure-payments');
  console.log('  cd apps/web && npx vercel --prod --yes');
  console.log('  Then retry failed deliveries in Bridge dashboard');
}

loadEnvLocal();
const apiKey = process.env.BRIDGE_API_KEY?.trim();
if (!apiKey) {
  console.error('BRIDGE_API_KEY missing (set in apps/web/.env.local)');
  process.exit(1);
}

const cmd = process.argv[2];
if (cmd === 'check') {
  await check(apiKey);
} else if (cmd === 'fix') {
  await fix(apiKey);
} else {
  console.error('Usage: node scripts/bridge-sync-webhook.mjs check|fix');
  process.exit(1);
}
