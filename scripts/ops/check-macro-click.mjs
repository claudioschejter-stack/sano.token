#!/usr/bin/env node
/**
 * Decir si las credenciales de Click de Pago funcionan, antes de descubrirlo con
 * un cobro real.
 *
 * Macro manda tres valores por mail y no hay forma de saber desde el panel si
 * quedaron bien cargados: el checkout es un POST de formulario, así que un GUID
 * equivocado no da un error claro sino una pantalla de PlusPagos que rechaza al
 * llegar. La API REST sí tiene un endpoint de identificación, y eso es lo que este
 * script usa para responder la única pregunta que importa antes de probar: ¿el
 * comercio está reconocido?
 *
 * Uso:
 *   MACRO_CLICK_GUID=... MACRO_CLICK_FRASE=... MACRO_CLICK_SECRET_KEY=... \
 *     node scripts/ops/check-macro-click.mjs
 *
 * No imprime secretos: sólo su longitud y sus primeros caracteres, lo justo para
 * ver que no se pegó un valor cortado o con espacios.
 */

import { createHash } from 'node:crypto';

const ENV = (process.env.MACRO_CLICK_ENV ?? 'SANDBOX').trim().toUpperCase();
const IS_PROD = ENV === 'PRODUCTION' || ENV === 'PROD';

const API_BASE =
  process.env.MACRO_CLICK_API_BASE_URL?.trim().replace(/\/$/, '') ||
  (IS_PROD
    ? 'https://botonpp.asjservicios.com.ar:8082/v1'
    : 'https://sandboxpp.asjservicios.com.ar:8082/v1');

const CHECKOUT_URL =
  process.env.MACRO_CLICK_CHECKOUT_URL?.trim().replace(/\/$/, '') ||
  (IS_PROD ? 'https://botonpp.macroclickpago.com.ar' : 'https://sandboxpp.asjservicios.com.ar');

const GUID = process.env.MACRO_CLICK_GUID?.trim();
const FRASE = process.env.MACRO_CLICK_FRASE?.trim();
const SECRET = process.env.MACRO_CLICK_SECRET_KEY?.trim();
const ENTE = process.env.MACRO_CLICK_ENTE_CODE?.trim();

const TIMEOUT_MS = 20_000;

/**
 * Describir un secreto sin mostrarlo.
 *
 * La primera versión imprimía los primeros ocho caracteres, y para la FRASE eso es
 * material criptográfico: son 32 bytes de clave en base64, así que ocho caracteres
 * son seis bytes de la llave, en un log de CI o en una captura de pantalla.
 *
 * Lo que hacía falta era detectar un pegado mal hecho, y para eso alcanza con el
 * largo, si quedó espacio al principio o al final, y una huella. La huella permite
 * comparar "¿es el mismo valor que tengo en Vercel?" sin revelarlo: se calcula sobre
 * el valor con una etiqueta fija, y son ocho hex de un sha256 sobre un secreto de
 * alta entropía, así que no se puede volver atrás.
 */
function describeSecret(envKey) {
  const raw = process.env[envKey] ?? '';
  const trimmed = raw.trim();
  if (!trimmed) return 'AUSENTE';

  const fingerprint = createHash('sha256')
    .update(`macro-click-fingerprint:${trimmed}`)
    .digest('hex')
    .slice(0, 8);
  const whitespace = raw !== trimmed ? ' — OJO: venía con espacios alrededor' : '';

  return `${trimmed.length} chars, huella ${fingerprint}${whitespace}`;
}

/** El GUID no es secreto: viaja en el formulario que se le manda al navegador. */
function hint(value) {
  if (!value) return 'AUSENTE';
  return value;
}

async function request(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const text = await res.text();
    return { ok: true, status: res.status, text, ms: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, error, ms: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeJwt(value) {
  return typeof value === 'string' && value.split('.').length >= 3;
}

let failed = false;
function fail(message) {
  failed = true;
  console.log(`  FALLA  ${message}`);
}

console.log(`Ambiente declarado: ${ENV}${IS_PROD ? '' : ' (default)'}`);
console.log(`  API      ${API_BASE}`);
console.log(`  Checkout ${CHECKOUT_URL}/`);
console.log('\nCredenciales presentes:');
console.log(`  MACRO_CLICK_GUID        ${hint(GUID)}`);
console.log(`  MACRO_CLICK_FRASE       ${describeSecret('MACRO_CLICK_FRASE')}`);
console.log(`  MACRO_CLICK_SECRET_KEY  ${describeSecret('MACRO_CLICK_SECRET_KEY')}`);
console.log(`  MACRO_CLICK_ENTE_CODE   ${ENTE || 'sin Botón Simple'}`);

if (!GUID || !FRASE || !SECRET) {
  console.log('\nFaltan credenciales obligatorias; el checkout va a estar deshabilitado.');
  process.exit(1);
}

console.log('\nChequeos:');

const health = await request(`${API_BASE}/health`);
if (!health.ok) {
  fail(`/health no respondió (${health.error.name}) — ¿hay salida a internet al puerto 8082?`);
} else if (health.status !== 200) {
  fail(`/health devolvió HTTP ${health.status}`);
} else {
  console.log(`  ok     /health responde en ${health.ms}ms`);
}

const session = await request(`${API_BASE}/sesion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ guid: GUID, frase: FRASE })
});

if (!session.ok) {
  fail(`/sesion no respondió (${session.error.name})`);
} else if (session.status !== 200) {
  fail(`/sesion devolvió HTTP ${session.status}: ${session.text.slice(0, 200)}`);
} else {
  let body = null;
  try {
    body = JSON.parse(session.text);
  } catch {
    fail('/sesion respondió algo que no es JSON');
  }

  if (body) {
    const data = body.data;
    const token = looksLikeJwt(data)
      ? data
      : (data?.token ?? data?.access_token ?? data?.jwt ?? null);

    if (!looksLikeJwt(token)) {
      fail(`/sesion no devolvió un JWT donde el código lo busca: ${session.text.slice(0, 200)}`);
    } else {
      console.log(`  ok     comercio reconocido — "${body.message ?? 'sin mensaje'}"`);
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        if (payload.exp && payload.nbf) {
          const minutes = Math.round((payload.exp - payload.nbf) / 60);
          console.log(`  ok     token válido por ${minutes} minutos`);
        }
      } catch {
        // Un JWT que no se puede leer igual sirve: lo valida Macro, no nosotros.
      }
    }
  }
}

const checkout = await request(`${CHECKOUT_URL}/`);
if (!checkout.ok) {
  fail(`la URL de checkout no respondió (${checkout.error.name})`);
} else if (checkout.status >= 400) {
  fail(`la URL de checkout devolvió HTTP ${checkout.status}`);
} else {
  console.log(`  ok     URL de checkout responde HTTP ${checkout.status}`);
}

if (ENTE) {
  const debtUrl =
    process.env.MACRO_CLICK_DEBT_SEARCH_URL?.trim() ||
    (IS_PROD ? null : `https://sandboxpp.asjservicios.com.ar:8110/${ENTE}`);
  if (!debtUrl) {
    console.log('  nota   Botón Simple en producción necesita MACRO_CLICK_DEBT_SEARCH_URL explícita');
  } else {
    const debt = await request(debtUrl, { redirect: 'manual' });
    if (!debt.ok) {
      fail(`la búsqueda de deuda no respondió (${debt.error.name}) — puerto 8110`);
    } else {
      console.log(`  ok     búsqueda de deuda responde HTTP ${debt.status}`);
    }
  }
}

console.log(
  failed
    ? '\nHay chequeos en rojo: no conviene probar cobros hasta resolverlos.'
    : '\nTodo verde. Falta declarar del lado de Macro la URL de notificación:\n  https://<dominio>/api/webhooks/macro-click'
);

process.exit(failed ? 1 : 0);
