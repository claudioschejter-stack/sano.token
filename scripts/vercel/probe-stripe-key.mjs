#!/usr/bin/env node
const key = process.argv[2] || process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('missing key');
  process.exit(1);
}
const response = await fetch('https://api.stripe.com/v1/balance', {
  headers: { Authorization: `Bearer ${key}` }
});
const body = await response.text();
console.log(`status=${response.status}`);
console.log(body.slice(0, 300));
process.exit(response.ok ? 0 : 1);
