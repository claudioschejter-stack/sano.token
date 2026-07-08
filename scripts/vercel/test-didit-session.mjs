#!/usr/bin/env node
/**
 * Prueba la creación de sesión Didit usando variables de entorno del runtime.
 *
 * Uso recomendado (Production, con secretos reales):
 *   cd apps/web
 *   npx vercel env run --environment production -- node ../../scripts/vercel/test-didit-session.mjs
 *
 * También podés usar el botón "Probar Didit" en Admin → Configuración en producción.
 */
const INVESTOR_KYC_WORKFLOW_ID = 'b722c869-04ad-4b6c-bf4c-e22ded12575d';

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  'https://www.sanovacapital.com'
).replace(/\/$/, '');

const apiKey = process.env.DIDIT_API_KEY?.trim();
const workflowId = process.env.DIDIT_WORKFLOW_ID?.trim() || INVESTOR_KYC_WORKFLOW_ID;
const callback = `${siteUrl}/kyc?returnTo=%2Fmarketplace&registered=1&didit=1`;

console.log('=== Didit session smoke test ===');
console.log('siteUrl:', siteUrl);
console.log('callback:', callback);
console.log('apiKey configured:', Boolean(apiKey));
console.log('workflowId:', workflowId);

if (!apiKey) {
  console.error('Missing DIDIT_API_KEY');
  process.exit(1);
}

const response = await fetch('https://verification.didit.me/v3/session/', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    accept: 'application/json'
  },
  body: JSON.stringify({
    workflow_id: workflowId,
    vendor_data: 'cli-didit-test',
    callback,
    callback_method: 'both',
    language: 'es'
  })
});

const body = await response.text();
console.log('HTTP', response.status);
console.log('body:', body.slice(0, 800));
process.exit(response.ok ? 0 : 1);
