/**
 * Probe dLocal Go API (api.dlocalgo.com) — not enterprise api.dlocal.com.
 */
import { createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLocal = join(__dirname, '../../apps/web/.env.local');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(envLocal);

const apiKey = process.env.DLOCAL_API_KEY?.trim();
const secret = process.env.DLOCAL_SECRET_KEY?.trim();
const merchantId = process.env.DLOCAL_GO_MERCHANT_ID?.trim() || '230197';
const openToken =
  process.env.DLOCAL_GO_OPEN_LINK_TOKEN?.trim() ||
  Buffer.from(`open_link:mid:${merchantId}`, 'utf8').toString('base64');

function sign(login, date, body, signingSecret) {
  return createHmac('sha256', signingSecret).update(`${login}${date}${body}`).digest('hex');
}

async function tryRequest(label, url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  console.log(`\n[${label}] ${init.method ?? 'GET'} ${url}`);
  console.log(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  return response.ok;
}

async function main() {
  console.log('=== dLocal Go probe (api.dlocalgo.com) ===');
  console.log(`Merchant ID: ${merchantId}`);
  console.log(`Open token: ${openToken}`);

  await tryRequest('open-init-get', `https://api.dlocalgo.com/v1/checkout/open/init/${openToken}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  if (apiKey && secret) {
    const basic = Buffer.from(`${apiKey}:${secret}`, 'utf8').toString('base64');
    await tryRequest('open-init-bearer', `https://api.dlocalgo.com/v1/checkout/open/init/${openToken}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
    });
    await tryRequest('open-init-basic', `https://api.dlocalgo.com/v1/checkout/open/init/${openToken}`, {
      method: 'GET',
      headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' }
    });

    const paymentBody = JSON.stringify({
      amount: 1050,
      currency: 'ARS',
      country: 'AR',
      payment_method_flow: 'REDIRECT',
      order_id: `go-probe-${Date.now()}`,
      notification_url: 'https://www.sanovacapital.com/api/webhooks/dlocal',
      callback_url: 'https://www.sanovacapital.com/marketplace/carrito?probe=dlocalgo'
    });
    const date = new Date().toISOString();
    const signature = sign(apiKey, date, paymentBody, secret);

    for (const path of ['/v1/payments', '/payments', '/v1/checkout/payments']) {
      await tryRequest(`hmac${path}`, `https://api.dlocalgo.com${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Date': date,
          'X-Login': apiKey,
          'X-Trans-Key': secret,
          'X-Version': '2.1',
          Authorization: `V2-HMAC-SHA256, Signature: ${signature}`
        },
        body: paymentBody
      });
    }

    await tryRequest('payments-apikey-header', 'https://api.dlocalgo.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Secret-Key': secret
      },
      body: paymentBody
    });
  }
}

main().catch(console.error);
