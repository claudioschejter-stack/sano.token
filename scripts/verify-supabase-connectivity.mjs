#!/usr/bin/env node
/**
 * Verifica conectividad Supabase REST (Storage/API) vs Postgres (Prisma).
 * Uso: node scripts/verify-supabase-connectivity.mjs
 * Carga .env desde repo root y apps/web/.env.local (sin imprimir secretos).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(root, '.env'));
loadEnvFile(resolve(root, 'apps/web/.env.local'));
// Root .env.local last — but skip DATABASE_URL/DIRECT_URL if already set by apps/web
const priorDb = process.env.DATABASE_URL;
const priorDirect = process.env.DIRECT_URL;
loadEnvFile(resolve(root, '.env.local'));
if (priorDb) process.env.DATABASE_URL = priorDb;
if (priorDirect) process.env.DIRECT_URL = priorDirect;

const supabaseUrl = (process.env.SUPABASE_URL ?? 'https://ugdmfewgxohbwggdiahp.supabase.co').replace(/\/$/, '');
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_KEY?.trim() || '';
const databaseUrl = process.env.DATABASE_URL?.trim() || '';

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}@${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return '(invalid URL)';
  }
}

console.log('--- Supabase connectivity check ---\n');
console.log(`Project URL: ${supabaseUrl}`);
console.log(`REST key (service_role): ${supabaseKey ? 'set' : 'MISSING'}`);
console.log(`DATABASE_URL (Prisma): ${databaseUrl ? redactDatabaseUrl(databaseUrl) : 'MISSING'}\n`);

async function checkRest() {
  if (!supabaseKey) {
    console.log('REST: SKIP — falta SUPABASE_SERVICE_ROLE_KEY o SUPABASE_KEY');
    return false;
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    if (res.ok || res.status === 404) {
      console.log(`REST: OK (${res.status}) — Storage/API accesible`);
      return true;
    }
    console.log(`REST: FAIL (${res.status}) — revisá la service_role key en Settings → API`);
    return false;
  } catch (err) {
    console.log(`REST: FAIL — ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function checkPostgres() {
  if (!databaseUrl) {
    console.log('Postgres: SKIP — falta DATABASE_URL en .env o apps/web/.env.local');
    console.log('  → Supabase Dashboard → Settings → Database → Connection string (URI)');
    console.log('  → Transaction pooler :6543 para DATABASE_URL, Session/direct :5432 para DIRECT_URL');
    return false;
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Postgres: OK — Prisma conectó a la base');
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('P1000') || msg.includes('Authentication failed')) {
      console.log('Postgres: FAIL — contraseña de DB incorrecta (no es la SUPABASE_KEY JWT)');
      console.log('  → Reset password: Dashboard → Database → Reset database password');
    } else if (msg.includes("Can't reach")) {
      console.log('Postgres: FAIL — no se alcanza el host (firewall, proyecto pausado o pooler caído)');
    } else {
      console.log(`Postgres: FAIL — ${msg.split('\n')[0]}`);
    }
    return false;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

const restOk = await checkRest();
const pgOk = await checkPostgres();

console.log('\n--- Resumen ---');
console.log(`REST (Storage/API): ${restOk ? 'OK' : 'revisar'}`);
console.log(`Postgres (Prisma):  ${pgOk ? 'OK' : 'revisar'}`);

if (!pgOk) {
  console.log('\nPara build local: agregá DATABASE_URL y DIRECT_URL en apps/web/.env.local');
  process.exit(1);
}

process.exit(0);
