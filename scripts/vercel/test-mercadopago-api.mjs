#!/usr/bin/env node
const tokens = {
  testUser: process.env.MP_TEST_TOKEN || 'TEST-8a7a1a88-5b8c-49a0-8254-ce2648812c84',
  production: process.env.MP_PROD_TOKEN || process.argv[2]
};

async function probe(label, token) {
  if (!token) {
    console.log(`[${label}] skip (no token)`);
    return;
  }

  const body = {
    items: [{ title: 'Sanova integration test', quantity: 1, currency_id: 'ARS', unit_price: 1050 }],
    back_urls: {
      success: 'https://www.sanovacapital.com/marketplace/carrito?status=success',
      failure: 'https://www.sanovacapital.com/marketplace/carrito?status=failed',
      pending: 'https://www.sanovacapital.com/marketplace/carrito?status=pending'
    },
    notification_url: 'https://www.sanovacapital.com/api/webhooks/mercadopago',
    auto_return: 'approved'
  };

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }

  const checkoutUrl = parsed.sandbox_init_point || parsed.init_point;
  console.log(`[${label}] status=${response.status} sandbox=${Boolean(parsed.sandbox_init_point)} checkout=${checkoutUrl ? 'yes' : 'no'}`);
  if (!checkoutUrl) {
    console.log(`[${label}] error:`, JSON.stringify(parsed).slice(0, 300));
  }
  return { ok: response.ok, checkoutUrl, parsed };
}

const results = await Promise.all([
  probe('user-test-credential', tokens.testUser),
  probe('production-token', tokens.production)
]);

const prodOk = results[1]?.ok;
process.exit(prodOk ? 0 : 1);
