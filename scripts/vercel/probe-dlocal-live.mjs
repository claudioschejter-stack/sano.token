/**
 * Live probe: creates a minimal dLocal redirect payment (not completed).
 * Usage (from repo root):
 *   node scripts/vercel/probe-dlocal-live.mjs
 * Loads apps/web/.env.local when present.
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

const login = process.env.DLOCAL_API_KEY?.trim() || process.env.DLOCAL_X_LOGIN?.trim();
const transKey =
  process.env.DLOCAL_X_TRANS_KEY?.trim() ||
  (process.env.DLOCAL_SECRET_KEY?.trim() && !process.env.DLOCAL_NOTIFICATION_SECRET?.trim()
    ? process.env.DLOCAL_SECRET_KEY.trim()
    : null);
const signingSecret =
  process.env.DLOCAL_SECRET_KEY?.trim() ||
  process.env.DLOCAL_NOTIFICATION_SECRET?.trim() ||
  transKey;

const country = process.env.DLOCAL_DEFAULT_COUNTRY?.trim().toUpperCase() || 'AR';
const fxArs = Number(process.env.DLOCAL_FX_ARS ?? process.env.MERCADOPAGO_FX_ARS ?? 1050);
const amountUsd = Number(process.env.DLOCAL_PROBE_AMOUNT_USD ?? 1);
const amountLocal = Math.round(amountUsd * fxArs * 100) / 100;
const externalId = `probe-${Date.now()}`;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.sanovacapital.com';

function sign(loginId, date, body, secret) {
  return createHmac('sha256', secret).update(`${loginId}${date}${body}`).digest('hex');
}

const apiBases = (process.env.DLOCAL_PROBE_BASES ?? process.env.DLOCAL_API_BASE_URL ?? 'https://api.dlocal.com')
  .split(',')
  .map((row) => row.trim().replace(/\/$/, ''))
  .filter(Boolean);

async function tryPayment(apiBase, transKey, signingSecret, label) {
  const body = {
    amount: amountLocal,
    currency: country === 'AR' ? 'ARS' : 'USD',
    country,
    payment_method_id: 'IO',
    payment_method_flow: 'REDIRECT',
    payer: { email: 'probe@sanovacapital.com' },
    order_id: `${externalId}-${label}`,
    notification_url: `${siteUrl}/api/webhooks/dlocal`,
    callback_url: `${siteUrl}/marketplace/carrito?probe=dlocal&status=success`,
    description: `Sanova dLocal probe ${label}`
  };

  const bodyText = JSON.stringify(body);
  const date = new Date().toISOString();
  const signature = sign(login, date, bodyText, signingSecret);

  const response = await fetch(`${apiBase}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Date': date,
      'X-Login': login,
      'X-Trans-Key': transKey,
      'X-Version': '2.1',
      'User-Agent': 'SanovaCapital/1.0',
      Authorization: `V2-HMAC-SHA256, Signature: ${signature}`
    },
    body: bodyText
  });

  const text = await response.text();
  return { label, apiBase, status: response.status, text };
}

async function main() {
  console.log('=== dLocal live probe ===');
  console.log(`Country: ${country} | Amount: USD ${amountUsd} (~ ARS ${amountLocal})`);

  if (!login || !transKey || !signingSecret) {
    console.error('FAIL: missing DLOCAL_API_KEY, DLOCAL_X_TRANS_KEY, or DLOCAL_SECRET_KEY');
    process.exit(1);
  }

  const smartFields = process.env.DLOCAL_SMARTFIELDS_API_KEY?.trim();
  const attempts = [
    { label: 'default', trans: transKey, secret: signingSecret },
    ...(smartFields ? [{ label: 'smartfields-as-trans', trans: smartFields, secret: signingSecret }] : [])
  ];

  for (const base of apiBases.length ? apiBases : ['https://api.dlocal.com', 'https://sandbox.dlocal.com']) {
    for (const attempt of attempts) {
      const result = await tryPayment(base, attempt.trans, attempt.secret, attempt.label);
      console.log(`\n[${result.apiBase}] ${result.label} -> HTTP ${result.status}`);
      console.log(result.text.slice(0, 400));

      if (result.status >= 200 && result.status < 300) {
        let parsed;
        try {
          parsed = JSON.parse(result.text);
        } catch {
          parsed = null;
        }
        if (parsed?.redirect_url) {
          console.log('\nOK: dLocal accepted the payment request.');
          console.log(`Checkout URL: ${parsed.redirect_url}`);
          console.log(`Payment ID: ${parsed.id ?? 'n/a'} | Status: ${parsed.status ?? 'n/a'}`);
          console.log('\nAbrí esa URL en el navegador para completar el pago de prueba (~USD 1).');
          process.exit(0);
        }
      }
    }
  }

  console.error('\nFAIL: todas las combinaciones devolvieron error (403 Invalid credentials es lo más común).');
  console.error('Verificá en dLocal Go: 1) cuenta live vs sandbox, 2) X-Trans-Key separada del Secret Key, 3) IP whitelist.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
