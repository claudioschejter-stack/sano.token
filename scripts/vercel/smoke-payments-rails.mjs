#!/usr/bin/env node
/**
 * Per-rail readiness smoke (no live money).
 * Complements smoke-payments-health.mjs with Bridge webhook + AR/Privy catalog checks.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = (process.env.SMOKE_BASE_URL || 'https://sanovacapital.com').replace(/\/$/, '');
const web = join(dirname(fileURLToPath(import.meta.url)), '../../apps/web');

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  return { res, body };
}

async function postStatus(path) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  return res.status;
}

async function main() {
  const errors = [];
  const notes = [];

  const { res, body } = await fetchJson(`${base}/api/payments/health`);
  if (!res.ok || !body?.ok || !body.productionReady) {
    errors.push('health productionReady failed');
  }

  // --- Bridge (non-AR VA) ---
  if (!body?.gateways?.bridge) errors.push('Bridge gateway not configured');
  const bridgeWh = await postStatus('/api/webhooks/bridge');
  // 401 = signature rejected (endpoint live); 400/405 also prove routing
  if (![400, 401, 403, 405].includes(bridgeWh)) {
    errors.push(`Bridge webhook unexpected status ${bridgeWh}`);
  } else {
    notes.push(`Bridge webhook endpoint reachable (HTTP ${bridgeWh})`);
  }

  const bridgeCheck = spawnSync(process.execPath, ['scripts/bridge-setup.mjs', 'check'], {
    cwd: web,
    encoding: 'utf8',
    shell: false
  });
  const bridgeOut = `${bridgeCheck.stdout ?? ''}${bridgeCheck.stderr ?? ''}`;
  if (bridgeCheck.status !== 0 || !bridgeOut.includes('status=active')) {
    errors.push('bridge-setup.mjs check: no active webhook');
    console.log(bridgeOut);
  } else {
    notes.push('Bridge dashboard webhook active → /api/webhooks/bridge');
  }

  // --- Argentina MP + Ripio ---
  if (!body?.gateways?.mercadoPago || !body?.gateways?.mercadoPagoLive) {
    errors.push('Mercado Pago not live');
  }
  if (body?.mercadoPagoProbe?.ok !== true) errors.push('Mercado Pago probe failed');
  if (!body?.gateways?.ripio) errors.push('Ripio not configured');
  const mpWh = await postStatus('/api/webhooks/mercadopago');
  const ripioWh = await postStatus('/api/webhooks/ripio');
  notes.push(`MP webhook HTTP ${mpWh}; Ripio webhook HTTP ${ripioWh}`);
  if (![400, 401, 403, 405, 500].includes(mpWh)) {
    errors.push(`MP webhook unexpected status ${mpWh}`);
  }
  if (![400, 401, 403, 405, 500].includes(ripioWh)) {
    errors.push(`Ripio webhook unexpected status ${ripioWh}`);
  }
  const arLabels = body?.checkoutArgentina?.configuredLabels ?? [];
  if (!arLabels.some((l) => /Mercado Pago/i.test(l))) {
    errors.push('Checkout AR missing Mercado Pago option');
  }
  notes.push('AR checkout: MP + Ripio ready (live deposit still human)');

  // --- Privy / USDC ---
  if (!body?.gateways?.usdcOnchain) errors.push('USDC on-chain path not ready');
  if (!arLabels.some((l) => /Privy/i.test(l))) {
    errors.push('Checkout missing Privy Wallet option');
  } else {
    notes.push('Privy Wallet (USDC Base) listed in checkout');
  }

  console.log('\nNotes:');
  for (const n of notes) console.log(`  · ${n}`);

  if (errors.length) {
    console.error('\nRAILS SMOKE FAIL:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('\nRAILS SMOKE OK');
  console.log('Human follow-ups (live money): see docs/runbooks/payments-go-live.md § Operator smoke tests');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
