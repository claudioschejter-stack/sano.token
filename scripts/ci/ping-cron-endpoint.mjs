#!/usr/bin/env node
/**
 * Disparar un endpoint de cron y fallar si algo se rompió — incluso cuando la
 * respuesta es 200.
 *
 * `watch-crypto-deposits` corre varias etapas y devuelve 200 con
 * `{"ok":false,"degraded":true,"failures":[…]}` cuando algunas fallan pero no
 * todas. La intención era no poner el workflow en rojo por un scan degradado. El
 * resultado fue peor: la etapa `privyInbound` venía tirando excepción en cada
 * corrida desde hacía semanas —la red de seguridad de los depósitos, muerta— y el
 * workflow se veía verde porque `curl --fail` solo mira el código de estado.
 *
 * Así que acá `ok: false` falla. Si esto resulta ruidoso, la solución es arreglar
 * la etapa que falla, no volver a esconderla: `runStage` atrapa excepciones
 * reales, y las que vimos eran errores permanentes de validación, no clima.
 *
 * Uso:
 *   CRON_EXTERNAL_SECRET=… node scripts/ci/ping-cron-endpoint.mjs endpoint [endpoint…]
 */

const BASE_URL =
  process.env.CRON_TARGET_BASE_URL?.trim() || 'https://sano-token-web.vercel.app';
const SECRET = process.env.CRON_EXTERNAL_SECRET?.trim();
const TIMEOUT_MS = Number(process.env.CRON_PING_TIMEOUT_MS ?? '280000');

const endpoints = process.argv.slice(2).filter(Boolean);

if (endpoints.length === 0) {
  console.error('::error::No se pasó ningún endpoint.');
  process.exit(1);
}
if (!SECRET) {
  console.error(
    '::error::Falta CRON_EXTERNAL_SECRET. Cargalo como repository secret en GitHub (Settings → Secrets and variables → Actions) con el valor que tiene Vercel.'
  );
  process.exit(1);
}

/** Recorta para el log sin perder de vista que hubo más. */
function preview(text, max = 1500) {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}… (+${trimmed.length - max} car.)` : trimmed;
}

let failed = false;

for (const endpoint of endpoints) {
  const url = `${BASE_URL}/api/cron/${endpoint}`;
  console.log(`\n→ ${endpoint}`);

  let response;
  let body = '';
  /**
   * Controller explícito en vez de `AbortSignal.timeout`: ese timer queda
   * referenciado y mantiene el proceso vivo hasta que vence, así que en el camino
   * exitoso el script se colgaba los cuatro minutos y medio del timeout en lugar
   * de terminar. En un workflow eso es un job trabado que nunca reporta.
   */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${SECRET}` },
      signal: controller.signal
    });
    body = await response.text();
  } catch (error) {
    const reason = controller.signal.aborted ? `no respondió en ${TIMEOUT_MS} ms` : error.message;
    console.error(`::error::${endpoint}: la petición no llegó a completarse — ${reason}`);
    failed = true;
    continue;
  } finally {
    clearTimeout(timer);
  }

  console.log(`  HTTP ${response.status}`);
  if (body) console.log(`  ${preview(body)}`);

  if (!response.ok) {
    const hint =
      response.status === 401
        ? ' El token no coincide con el de Vercel (CRON_SECRET o CRON_EXTERNAL_SECRET).'
        : '';
    console.error(`::error::${endpoint}: HTTP ${response.status}.${hint}`);
    failed = true;
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Un 200 que no es JSON significa que respondió otra cosa, no la app.
    console.error(`::error::${endpoint}: respondió 200 con un cuerpo que no es JSON.`);
    failed = true;
    continue;
  }

  if (parsed?.ok === false) {
    const detail = Array.isArray(parsed.failures)
      ? parsed.failures.map((f) => `${f.stage}: ${f.error}`).join(' · ')
      : (parsed.error ?? 'sin detalle');
    console.error(`::error::${endpoint}: el endpoint reportó ok=false — ${preview(detail, 600)}`);
    failed = true;
    continue;
  }

  // `degraded` sin fallos: algo no se pudo verificar, pero nada se rompió.
  if (parsed?.degraded === true) {
    console.log(`::warning::${endpoint}: degradado, pero sin etapas caídas.`);
  }

  console.log(`  OK`);
}

if (failed) {
  console.error(
    '\n::error::Al menos un endpoint de mantenimiento falló. Un scan caído deja de encontrar dinero que ya llegó.'
  );
  process.exit(1);
}

console.log('\nTodos los endpoints respondieron OK.');
process.exit(0);
