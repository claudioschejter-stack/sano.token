#!/usr/bin/env node
/**
 * Verifica integraciones sin imprimir secretos.
 * Uso: node scripts/check-integrations.js
 */

const checks = [
  { name: 'Supabase URL', ok: () => Boolean(process.env.SUPABASE_URL?.trim()) },
  {
    name: 'Supabase service role',
    ok: () =>
      Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_KEY?.trim()
      ),
    hint: 'Supabase → Settings → API → service_role (pegala en SUPABASE_KEY o SUPABASE_SERVICE_ROLE_KEY)'
  },
  {
    name: 'Wallet deploy (TOKEN_DEPLOY_PRIVATE_KEY o PRIVATE_KEY)',
    ok: () => {
      const key = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
      return Boolean(key && key !== 'tu_llave_privada_de_metamask_aqui' && key.startsWith('0x'));
    },
    hint: 'MetaMask → exportar clave → fondear con ETH en Base Sepolia'
  },
  { name: 'Base RPC', ok: () => Boolean(process.env.BASE_RPC_URL?.trim()) },
  {
    name: 'Thirdweb (demo)',
    ok: () => Boolean(process.env.THIRDWEB_SECRET_KEY?.trim()),
    hint: 'thirdweb.com → Dashboard → API Keys'
  },
  { name: 'Database', ok: () => Boolean(process.env.DATABASE_URL?.trim()) }
];

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: 'apps/web/.env.local' });

console.log('\nSanova — estado de integraciones\n');

for (const check of checks) {
  const status = check.ok() ? 'OK' : 'FALTA';
  console.log(`  [${status}] ${check.name}`);
  if (status === 'FALTA' && check.hint) {
    console.log(`         → ${check.hint}`);
  }
}

console.log('');
