#!/usr/bin/env node
/**
 * Read-only smoke: production /api/payments/health must report
 * treasury-ready + core gateways (MP, Ripio, Bridge, Privy path via usdc).
 */
const base = (process.env.SMOKE_BASE_URL || 'https://sanovacapital.com').replace(/\/$/, '');

const requiredGateways = ['mercadoPago', 'ripio', 'bridge', 'usdcOnchain'];

async function main() {
  const url = `${base}/api/payments/health`;
  console.log(`GET ${url}`);
  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    console.error('FAIL: health HTTP', res.status, body);
    process.exit(1);
  }

  console.log(JSON.stringify(body, null, 2));

  const errors = [];
  if (!body.ok) errors.push('ok !== true');
  if (!body.productionReady) errors.push('productionReady !== true');
  if (!Array.isArray(body.networksReady) || !body.networksReady.includes('BASE')) {
    errors.push('BASE network not ready');
  }

  const gateways = body.gateways ?? {};
  for (const key of requiredGateways) {
    if (!gateways[key]) errors.push(`gateway.${key} !== true`);
  }

  if (body.mercadoPagoProbe && body.mercadoPagoProbe.ok !== true) {
    errors.push('mercadoPagoProbe.ok !== true');
  }

  if (Array.isArray(body.missingIntegrations) && body.missingIntegrations.includes('ripio')) {
    errors.push('ripio listed in missingIntegrations');
  }
  if (Array.isArray(body.missingIntegrations) && body.missingIntegrations.includes('bridge')) {
    errors.push('bridge listed in missingIntegrations');
  }

  if (errors.length) {
    console.error('\nSMOKE FAIL:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('\nSMOKE OK: productionReady + MP + Ripio + Bridge + USDC Base');
  console.log('Note: live deposit smoke (Bridge wire / MP→Ripio / Privy USDC pay) still requires a human investor test.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
