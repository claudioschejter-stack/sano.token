#!/usr/bin/env node
/**
 * Sync lending/blockchain env vars to Vercel (Production + Preview).
 * Reads values from repo .env — never logs secrets.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = {
  ...parseEnvFile(join(root, 'apps/web/.env.local')),
  ...parseEnvFile(join(root, '.env'))
};

function addEnv(name, value, environments = ['production', 'preview']) {
  if (!value?.trim()) {
    console.log(`skip ${name} (empty)`);
    return false;
  }
  for (const target of environments) {
    const result = spawnSync('npx', ['vercel', 'env', 'add', name, target, '--force'], {
      cwd: root,
      input: `${value.trim()}\n`,
      encoding: 'utf8',
      shell: true
    });
    if (result.status !== 0) {
      console.error(`failed ${name}@${target}:`, result.stderr?.slice(0, 200) || result.stdout?.slice(0, 200));
      return false;
    }
    console.log(`ok ${name}@${target}`);
  }
  return true;
}

const cronSecret =
  env.CRON_SECRET?.trim() ||
  createHash('sha256').update(randomBytes(32)).digest('hex');

const vars = [
  ['CRON_SECRET', cronSecret],
  ['BASE_RPC_URL', env.BASE_RPC_URL || 'https://mainnet.base.org'],
  ['LENDING_CHAIN_ID', env.LENDING_CHAIN_ID || '8453'],
  ['LENDING_BASE_RPC_URL', env.LENDING_BASE_RPC_URL || env.BASE_RPC_URL || 'https://mainnet.base.org'],
  ['LENDING_RATES_CACHE_TTL_MINUTES', env.LENDING_RATES_CACHE_TTL_MINUTES || '15'],
  ['LENDING_ONCHAIN_RATES', env.LENDING_ONCHAIN_RATES || 'true'],
  ['TOKEN_DEPLOY_CHAIN_ID', env.TOKEN_DEPLOY_CHAIN_ID || '8453'],
  ['TOKEN_DEPLOY_PRIVATE_KEY', env.TOKEN_DEPLOY_PRIVATE_KEY || env.PRIVATE_KEY],
  ['TOKEN_TREASURY_ADDRESS', env.TOKEN_TREASURY_ADDRESS || env.SANOVA_TREASURY_ADDRESS],
  ['AUTOMATION_TX_CONFIRMATIONS', env.AUTOMATION_TX_CONFIRMATIONS || '1'],
  ['AUTOMATION_DISABLED', env.AUTOMATION_DISABLED || 'false'],
  ['RWA_SYNTHETIC_ENABLED', env.RWA_SYNTHETIC_ENABLED || 'false'],
  ['RWA_SYNTHETIC_ALLOWED_CHAIN_IDS', env.RWA_SYNTHETIC_ALLOWED_CHAIN_IDS || '84532,80002,11155111'],
  ['RWA_SYNTHETIC_MAX_GAS_WEI', env.RWA_SYNTHETIC_MAX_GAS_WEI],
  ['RWA_DAILY_WITHDRAWAL_LIMIT_BPS', env.RWA_DAILY_WITHDRAWAL_LIMIT_BPS || '1000'],
  ['RWA_MAX_DAILY_BORROW_USD', env.RWA_MAX_DAILY_BORROW_USD || '250000'],
  ['RWA_BORROW_SAFETY_BPS', env.RWA_BORROW_SAFETY_BPS || '7000'],
  ['RWA_ALLOWED_EXTERNAL_CONTRACTS', env.RWA_ALLOWED_EXTERNAL_CONTRACTS],
  ['PAYMENT_ORDER_TTL_MINUTES', env.PAYMENT_ORDER_TTL_MINUTES || '30'],
  ['PAYMENT_MIN_CONFIRMATIONS', env.PAYMENT_MIN_CONFIRMATIONS || '2'],
  ['PAYMENT_MANUAL_REVIEW_RISK_SCORE', env.PAYMENT_MANUAL_REVIEW_RISK_SCORE || '60'],
  ['PAYMENT_HIGH_RISK_AMOUNT_USD', env.PAYMENT_HIGH_RISK_AMOUNT_USD || '10000'],
  ['PAYMENT_DAILY_USER_LIMIT_USD', env.PAYMENT_DAILY_USER_LIMIT_USD || '25000'],
  ['PAYMENT_DAILY_PROJECT_LIMIT_USD', env.PAYMENT_DAILY_PROJECT_LIMIT_USD || '250000'],
  ['PAYMENT_DAILY_WALLET_LIMIT_USD', env.PAYMENT_DAILY_WALLET_LIMIT_USD || '50000'],
  ['PAYMENT_CIRCUIT_BREAKER_FAILURES', env.PAYMENT_CIRCUIT_BREAKER_FAILURES || '5'],
  ['PAYMENT_CIRCUIT_BREAKER_WINDOW_MINUTES', env.PAYMENT_CIRCUIT_BREAKER_WINDOW_MINUTES || '30'],
  ['STABLECOIN_DEFAULT_NETWORK', env.STABLECOIN_DEFAULT_NETWORK || 'BASE'],
  ['STABLECOIN_ENABLED_NETWORKS', env.STABLECOIN_ENABLED_NETWORKS || 'BASE,POLYGON,TRON,SOLANA'],
  ['STABLECOIN_CHAIN_ID', env.STABLECOIN_CHAIN_ID || env.TOKEN_DEPLOY_CHAIN_ID || '84532'],
  ['USDC_TOKEN_ADDRESS', env.USDC_TOKEN_ADDRESS],
  ['USDC_DECIMALS', env.USDC_DECIMALS || '6'],
  ['STABLECOIN_TREASURY_ADDRESS', env.STABLECOIN_TREASURY_ADDRESS || env.TOKEN_TREASURY_ADDRESS || env.SANOVA_TREASURY_ADDRESS],
  ['STABLECOIN_CUSTODIAL_WALLET_ADDRESS', env.STABLECOIN_CUSTODIAL_WALLET_ADDRESS],
  ['BASE_STABLECOIN_CHAIN_ID', env.BASE_STABLECOIN_CHAIN_ID || '8453'],
  ['BASE_USDC_TOKEN_ADDRESS', env.BASE_USDC_TOKEN_ADDRESS || env.USDC_TOKEN_ADDRESS],
  ['BASE_STABLECOIN_TREASURY_ADDRESS', env.BASE_STABLECOIN_TREASURY_ADDRESS || env.STABLECOIN_TREASURY_ADDRESS],
  ['POLYGON_STABLECOIN_CHAIN_ID', env.POLYGON_STABLECOIN_CHAIN_ID || '137'],
  ['POLYGON_RPC_URL', env.POLYGON_RPC_URL],
  ['POLYGON_USDC_TOKEN_ADDRESS', env.POLYGON_USDC_TOKEN_ADDRESS],
  ['POLYGON_STABLECOIN_TREASURY_ADDRESS', env.POLYGON_STABLECOIN_TREASURY_ADDRESS],
  ['TRON_GRID_API_URL', env.TRON_GRID_API_URL || 'https://api.trongrid.io'],
  ['TRON_USDT_TOKEN_ADDRESS', env.TRON_USDT_TOKEN_ADDRESS],
  ['TRON_STABLECOIN_TREASURY_ADDRESS', env.TRON_STABLECOIN_TREASURY_ADDRESS],
  ['SOLANA_RPC_URL', env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'],
  ['SOLANA_USDC_MINT_ADDRESS', env.SOLANA_USDC_MINT_ADDRESS],
  ['SOLANA_STABLECOIN_TREASURY_ADDRESS', env.SOLANA_STABLECOIN_TREASURY_ADDRESS],
  ['LOCAL_RAILS_ENABLED', env.LOCAL_RAILS_ENABLED || 'false'],
  ['DLOCAL_API_KEY', env.DLOCAL_API_KEY],
  ['EBANX_API_KEY', env.EBANX_API_KEY],
  ['BRIDGE_API_KEY', env.BRIDGE_API_KEY],
  ['BRIDGE_WEBHOOK_SECRET', env.BRIDGE_WEBHOOK_SECRET],
  ['TRANSAK_API_KEY', env.TRANSAK_API_KEY],
  ['TRANSAK_WEBHOOK_SECRET', env.TRANSAK_WEBHOOK_SECRET],
  ['TRANSAK_ENV', env.TRANSAK_ENV || 'PRODUCTION'],
  ['RAMP_API_KEY', env.RAMP_API_KEY],
  ['RAMP_WEBHOOK_SECRET', env.RAMP_WEBHOOK_SECRET],
  ['STRIPE_SECRET_KEY', env.STRIPE_SECRET_KEY],
  ['STRIPE_WEBHOOK_SECRET', env.STRIPE_WEBHOOK_SECRET],
  ['MERCADOPAGO_ACCESS_TOKEN', env.MERCADOPAGO_ACCESS_TOKEN],
  ['MERCADOPAGO_WEBHOOK_SECRET', env.MERCADOPAGO_WEBHOOK_SECRET],
  ['COINBASE_COMMERCE_API_KEY', env.COINBASE_COMMERCE_API_KEY],
  ['COINBASE_COMMERCE_WEBHOOK_SECRET', env.COINBASE_COMMERCE_WEBHOOK_SECRET],
  ['MORPHO_CHAIN_ID', env.MORPHO_CHAIN_ID || env.LENDING_CHAIN_ID || '8453'],
  ['MORPHO_DEFAULT_LLTV_BPS', env.MORPHO_DEFAULT_LLTV_BPS || '6000'],
  ['MORPHO_ORACLE_ADDRESS', env.MORPHO_ORACLE_ADDRESS],
  ['MORPHO_CURATOR_ADDRESS', env.MORPHO_CURATOR_ADDRESS],
  ['RWA_OPERATOR_ADDRESS', env.RWA_OPERATOR_ADDRESS],
  ['RWA_ALLOWED_EXTERNAL_CONTRACTS', env.RWA_ALLOWED_EXTERNAL_CONTRACTS],
  ['BASESCAN_API_KEY', env.BASESCAN_API_KEY]
];

console.log('Syncing env vars to Vercel…');
for (const [name, value] of vars) {
  addEnv(name, value);
}
console.log('Done. Redeploy production for vars to take effect.');
