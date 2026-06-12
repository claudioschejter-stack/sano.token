#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, Wallet } from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const BASE_MORPHO = {
  8453: {
    morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    morphoIrm: '0x46415998764C29aB2a25CbeA6254146D50D22687'
  },
  84532: {
    morpho: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    morphoIrm: '0x870aC11D48B15DB9f1382786706e8e7A239D8928'
  }
};

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

const morphoChainId = Number(env.MORPHO_CHAIN_ID || env.LENDING_CHAIN_ID || '8453');
const treasury = env.TOKEN_TREASURY_ADDRESS?.trim();
const operator = env.RWA_OPERATOR_ADDRESS?.trim();
const deployKey = env.TOKEN_DEPLOY_PRIVATE_KEY?.trim();

console.log('=== Sanova — Morpho on-chain (Paso 2) ===\n');
console.log(`Morpho chain: ${morphoChainId} (${morphoChainId === 8453 ? 'Base mainnet' : 'otra red'})`);
console.log(`Treasury Safe: ${treasury || '(vacío)'}`);
console.log(`Operador RWA: ${operator || '(vacío)'}`);

const checks = [];
checks.push(['TOKEN_DEPLOY_PRIVATE_KEY', Boolean(deployKey)]);
checks.push(['TOKEN_TREASURY_ADDRESS', Boolean(treasury)]);
checks.push(['RWA_OPERATOR_ADDRESS', Boolean(operator)]);
checks.push(['MORPHO_CHAIN_ID', Boolean(env.MORPHO_CHAIN_ID?.trim())]);
checks.push(['MORPHO_DEFAULT_LLTV_BPS', Boolean(env.MORPHO_DEFAULT_LLTV_BPS?.trim())]);
checks.push(['LENDING_BASE_RPC_URL / BASE_RPC_URL', Boolean(env.LENDING_BASE_RPC_URL?.trim() || env.BASE_RPC_URL?.trim())]);

console.log('\nConfiguración:');
let ready = true;
for (const [label, ok] of checks) {
  if (!ok) ready = false;
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
}

if (treasury && operator && treasury.toLowerCase() === operator.toLowerCase()) {
  ready = false;
  console.log('\n✗ Operador y treasury no pueden ser la misma address.');
} else if (treasury && operator) {
  console.log('\n✓ Operador separado del Safe treasury.');
}

if (deployKey && operator) {
  const derived = new Wallet(deployKey).address.toLowerCase();
  if (derived !== operator.toLowerCase()) {
    ready = false;
    console.log('✗ RWA_OPERATOR_ADDRESS no coincide con TOKEN_DEPLOY_PRIVATE_KEY.');
  } else {
    console.log('✓ Operador coincide con la wallet de deploy.');
  }
}

const lending = BASE_MORPHO[morphoChainId];
if (!lending) {
  ready = false;
  console.log(`\n✗ Chain ${morphoChainId} no soportada para Morpho en este script.`);
} else {
  console.log('\nContratos Morpho:');
  console.log(`  Morpho Blue: ${lending.morpho}`);
  console.log(`  USDC:        ${lending.usdc}`);
  console.log(`  IRM:         ${lending.morphoIrm}`);
}

if (deployKey && lending) {
  const rpc =
    env.LENDING_BASE_RPC_URL?.trim() ||
    env.BASE_RPC_URL?.trim() ||
    (morphoChainId === 8453 ? 'https://mainnet.base.org' : 'https://sepolia.base.org');
  const provider = new JsonRpcProvider(rpc);
  try {
    const wallet = new Wallet(deployKey, provider);
    const balance = await provider.getBalance(wallet.address);
    const hasGas = balance > 0n;
    console.log(`\nGas deploy wallet (${wallet.address}): ${hasGas ? '✓' : '✗'} ${balance.toString()} wei`);
    if (!hasGas) {
      ready = false;
      console.log(`  → Enviá ETH en Base (${morphoChainId}) a esa wallet para crear mercados Morpho.`);
    }
  } catch (error) {
    ready = false;
    console.log('\n✗ Error consultando gas:', error instanceof Error ? error.message : error);
  } finally {
    provider.destroy();
  }
}

console.log('\nFlujo admin (por proyecto ERC-4626):');
console.log('  1. Deploy token + vault ERC-4626');
console.log('  2. Seleccionar colateral MORPHO en el launch');
console.log('  3. POST /api/admin/assets/{projectId}/register-collateral  { "protocols": ["MORPHO"] }');
console.log('  4. Cuando morphoLiquidityStatus=LIQUID → readyToBorrow=true');

console.log(`\nMorpho listo para automatización: ${ready ? 'SÍ' : 'NO'}`);
console.log('\nComandos:');
console.log('  npm run vercel:sync-lending');
console.log('  Redeploy production');

process.exit(ready ? 0 : 1);
