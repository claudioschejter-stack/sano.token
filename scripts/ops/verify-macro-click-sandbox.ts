#!/usr/bin/env node
/**
 * Verifies Click de Pago sandbox credentials (session + health).
 *
 * Usage (never commit secrets):
 *   export MACRO_CLICK_GUID=...
 *   export MACRO_CLICK_FRASE=...
 *   export MACRO_CLICK_SECRET_KEY=...
 *   export MACRO_CLICK_ENV=SANDBOX
 *   npx tsx scripts/ops/verify-macro-click-sandbox.ts
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isMacroClickConfigured,
  macroClickEnv,
  macroClickApiBaseUrl,
  macroClickCheckoutPostUrl,
  macroClickDebtSearchUrl,
  macroClickEnteCode
} from '../../apps/web/src/lib/payments/macroClick/config';
import { getMacroClickSessionToken, macroClickHealth } from '../../apps/web/src/lib/payments/macroClick/apiClient';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.macro-sandbox.local') });
config({ path: resolve(__dirname, '../../.env.local') });
config({ path: resolve(__dirname, '../../.env') });

async function main() {
  console.log('env', macroClickEnv());
  console.log('api', macroClickApiBaseUrl());
  console.log('checkout POST', macroClickCheckoutPostUrl());
  console.log('ente', macroClickEnteCode() || '(none)');
  console.log('debt search', macroClickDebtSearchUrl() || '(none)');
  console.log('configured', isMacroClickConfigured());

  if (!isMacroClickConfigured()) {
    throw new Error('Set MACRO_CLICK_GUID, MACRO_CLICK_FRASE, MACRO_CLICK_SECRET_KEY');
  }

  const health = await macroClickHealth();
  console.log('health', health);

  const token = await getMacroClickSessionToken(true);
  console.log('session ok', `${token.slice(0, 24)}… (${token.length} chars)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
