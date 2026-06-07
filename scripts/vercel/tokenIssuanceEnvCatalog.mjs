/**
 * Catálogo de variables para emisión RWA (ERC-4626 / ERC-7540) + Morpho + Centrifuge.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function hasDeployKey(env) {
  return Boolean(env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() || env.PRIVATE_KEY?.trim());
}

function deriveAddressFromKey(privateKey) {
  try {
    const { Wallet } = require('ethers');
    return new Wallet(privateKey.trim()).address;
  } catch {
    return null;
  }
}

export const BASE_CHAIN_ID = '8453';
export const PLUME_CHAIN_ID = '98866';

export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const PLUME_NATIVE_USDC = '0x222365EF19F7947e5484218551B56bb3965Aa7aF';
export const MORPHO_BLUE = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

/** Variables que el script puede aplicar con defaults (sin secretos del usuario). */
export const AUTO_CONFIGURE_KEYS = [
  'TOKEN_DEPLOY_CHAIN_ID',
  'MORPHO_CHAIN_ID',
  'LENDING_CHAIN_ID',
  'NEXT_PUBLIC_CHAIN_ID',
  'BASE_RPC_URL',
  'LENDING_BASE_RPC_URL',
  'NEXT_PUBLIC_BASE_RPC_URL',
  'NEXT_PUBLIC_BASE_USDC_TOKEN_ADDRESS',
  'BASE_USDC_TOKEN_ADDRESS',
  'MORPHO_DEFAULT_LLTV_BPS',
  'MORPHO_SEED_LIQUIDITY_USDC',
  'AUTOMATION_TX_CONFIRMATIONS',
  'AUTOMATION_DISABLED',
  'AUTOMATION_ASYNC_DEPLOY',
  'NEXT_PUBLIC_PLUME_ENABLED',
  'PLUME_RPC_URL',
  'NEXT_PUBLIC_PLUME_RPC_URL',
  'PLUME_USDC_TOKEN_ADDRESS',
  'NEXT_PUBLIC_PLUME_USDC_TOKEN_ADDRESS',
  'MORPHO_PLUME_ADDRESS',
  'MORPHO_PLUME_IRM_ADDRESS',
  'MORPHO_PLUME_LLTV_BPS'
];

/** Secretos / credenciales — solo se suben si existen en .env local. */
export const SECRET_SYNC_KEYS = [
  'TOKEN_DEPLOY_PRIVATE_KEY',
  'PRIVATE_KEY',
  'TOKEN_TREASURY_ADDRESS',
  'RWA_OPERATOR_ADDRESS',
  'TREASURY_OWNER_PRIVATE_KEY',
  'CENTRIFUGE_API_KEY',
  'CENTRIFUGE_POOL_ADMIN_URL',
  'MORPHO_API_KEY',
  'MORPHO_CURATOR_ADDRESS',
  'MORPHO_ORACLE_ADDRESS',
  'BASESCAN_API_KEY'
];

export const MANUAL_TASK_GROUPS = [
  {
    id: 'deploy_wallet',
    label: 'Wallet de emisión on-chain',
    keys: ['TOKEN_DEPLOY_PRIVATE_KEY'],
    hint: 'Private key con gas (ETH en Base o PLUME en Plume). Nunca commitear.'
  },
  {
    id: 'treasury',
    label: 'Treasury Safe + operador',
    keys: ['TOKEN_TREASURY_ADDRESS', 'RWA_OPERATOR_ADDRESS'],
    hint: 'Operador debe ser distinto del Safe y coincidir con la wallet de deploy.'
  },
  {
    id: 'centrifuge',
    label: 'Centrifuge Hub (colateral RWA)',
    keys: ['CENTRIFUGE_API_KEY', 'CENTRIFUGE_POOL_ADMIN_URL'],
    hint: 'Panel Centrifuge → API key + URL admin del pool.'
  },
  {
    id: 'morpho_institutional',
    label: 'Morpho curator / listado (opcional)',
    keys: ['MORPHO_API_KEY', 'MORPHO_CURATOR_ADDRESS'],
    hint: 'Para listado en app.morpho.org; el mercado on-chain se crea sin esto.'
  },
  {
    id: 'explorer',
    label: 'Verificación Basescan (Base)',
    keys: ['BASESCAN_API_KEY'],
    hint: 'https://basescan.org/myapikey — solo si TOKEN_DEPLOY_CHAIN_ID=8453.'
  },
  {
    id: 'treasury_migration',
    label: 'Migración shares treasury → inversor (opcional)',
    keys: ['TREASURY_OWNER_PRIVATE_KEY'],
    hint: 'Owner del Safe para transferir shares a wallet Coinbase del inversor.'
  }
];

export function buildBaseDefaults() {
  return {
    TOKEN_DEPLOY_CHAIN_ID: BASE_CHAIN_ID,
    MORPHO_CHAIN_ID: BASE_CHAIN_ID,
    LENDING_CHAIN_ID: BASE_CHAIN_ID,
    NEXT_PUBLIC_CHAIN_ID: BASE_CHAIN_ID,
    BASE_RPC_URL: 'https://mainnet.base.org',
    LENDING_BASE_RPC_URL: 'https://mainnet.base.org',
    NEXT_PUBLIC_BASE_RPC_URL: 'https://mainnet.base.org',
    NEXT_PUBLIC_BASE_USDC_TOKEN_ADDRESS: BASE_USDC,
    BASE_USDC_TOKEN_ADDRESS: BASE_USDC,
    MORPHO_DEFAULT_LLTV_BPS: '6250',
    MORPHO_SEED_LIQUIDITY_USDC: '500',
    AUTOMATION_TX_CONFIRMATIONS: '1',
    AUTOMATION_DISABLED: 'false',
    AUTOMATION_ASYNC_DEPLOY: 'true',
    NEXT_PUBLIC_PLUME_ENABLED: 'false'
  };
}

export function buildPlumeDefaults() {
  return {
    ...buildBaseDefaults(),
    TOKEN_DEPLOY_CHAIN_ID: PLUME_CHAIN_ID,
    MORPHO_CHAIN_ID: PLUME_CHAIN_ID,
    LENDING_CHAIN_ID: PLUME_CHAIN_ID,
    NEXT_PUBLIC_CHAIN_ID: PLUME_CHAIN_ID,
    PLUME_RPC_URL: 'https://rpc.plume.org',
    NEXT_PUBLIC_PLUME_RPC_URL: 'https://rpc.plume.org',
    NEXT_PUBLIC_PLUME_ENABLED: 'true',
    PLUME_USDC_TOKEN_ADDRESS: PLUME_NATIVE_USDC,
    NEXT_PUBLIC_PLUME_USDC_TOKEN_ADDRESS: PLUME_NATIVE_USDC,
    MORPHO_PLUME_ADDRESS: MORPHO_BLUE,
    MORPHO_PLUME_IRM_ADDRESS: '0x46415998764c29ab2a25cbea6254146d50d22687',
    MORPHO_PLUME_LLTV_BPS: '6250'
  };
}

const PROFILE_LOCKED_KEYS = {
  base: [
    'TOKEN_DEPLOY_CHAIN_ID',
    'MORPHO_CHAIN_ID',
    'LENDING_CHAIN_ID',
    'NEXT_PUBLIC_CHAIN_ID',
    'NEXT_PUBLIC_PLUME_ENABLED',
    'NEXT_PUBLIC_BASE_USDC_TOKEN_ADDRESS',
    'BASE_USDC_TOKEN_ADDRESS'
  ],
  plume: [
    'TOKEN_DEPLOY_CHAIN_ID',
    'MORPHO_CHAIN_ID',
    'LENDING_CHAIN_ID',
    'NEXT_PUBLIC_CHAIN_ID',
    'NEXT_PUBLIC_PLUME_ENABLED',
    'PLUME_RPC_URL',
    'NEXT_PUBLIC_PLUME_RPC_URL',
    'PLUME_USDC_TOKEN_ADDRESS',
    'NEXT_PUBLIC_PLUME_USDC_TOKEN_ADDRESS',
    'MORPHO_PLUME_ADDRESS',
    'MORPHO_PLUME_IRM_ADDRESS',
    'MORPHO_PLUME_LLTV_BPS'
  ]
};

export function mergeTokenIssuanceEnv(localEnv, profile = 'base') {
  const defaults = profile === 'plume' ? buildPlumeDefaults() : buildBaseDefaults();
  const locked = new Set(PROFILE_LOCKED_KEYS[profile] ?? []);
  const merged = { ...defaults };

  for (const [key, value] of Object.entries(localEnv)) {
    if (locked.has(key)) continue;
    if (value?.trim()) merged[key] = value.trim();
  }

  for (const key of locked) {
    if (defaults[key] !== undefined) merged[key] = defaults[key];
  }

  if (!merged.TOKEN_DEPLOY_PRIVATE_KEY?.trim() && merged.PRIVATE_KEY?.trim()) {
    merged.TOKEN_DEPLOY_PRIVATE_KEY = merged.PRIVATE_KEY;
  }

  if (!merged.TOKEN_TREASURY_ADDRESS?.trim() && localEnv.SANOVA_TREASURY_ADDRESS?.trim()) {
    merged.TOKEN_TREASURY_ADDRESS = localEnv.SANOVA_TREASURY_ADDRESS.trim();
  }

  return merged;
}

export function evaluateTokenIssuanceReadiness(env) {
  const chainId = Number(env.TOKEN_DEPLOY_CHAIN_ID || BASE_CHAIN_ID);
  const isPlume = chainId === Number(PLUME_CHAIN_ID);

  const hasDeployKey = Boolean(env.TOKEN_DEPLOY_PRIVATE_KEY?.trim());
  const hasTreasury = Boolean(env.TOKEN_TREASURY_ADDRESS?.trim());
  const hasOperator = Boolean(env.RWA_OPERATOR_ADDRESS?.trim());
  const hasRpc = isPlume
    ? Boolean(env.PLUME_RPC_URL?.trim())
    : Boolean(env.BASE_RPC_URL?.trim() || env.LENDING_BASE_RPC_URL?.trim());
  const hasUsdc = isPlume
    ? Boolean(env.PLUME_USDC_TOKEN_ADDRESS?.trim())
    : Boolean(env.BASE_USDC_TOKEN_ADDRESS?.trim() || env.NEXT_PUBLIC_BASE_USDC_TOKEN_ADDRESS?.trim());
  const centrifugeReady =
    Boolean(env.CENTRIFUGE_API_KEY?.trim()) && Boolean(env.CENTRIFUGE_POOL_ADMIN_URL?.trim());

  const operatorMatchesDeploy =
    hasDeployKey &&
    hasOperator &&
    env.RWA_OPERATOR_ADDRESS?.toLowerCase() ===
      deriveAddressFromKey(env.TOKEN_DEPLOY_PRIVATE_KEY)?.toLowerCase();

  const treasuryDistinct =
    !hasTreasury ||
    !hasOperator ||
    env.TOKEN_TREASURY_ADDRESS?.toLowerCase() !== env.RWA_OPERATOR_ADDRESS?.toLowerCase();

  const canDeployOnChain =
    hasDeployKey && hasTreasury && hasOperator && hasRpc && treasuryDistinct;

  return {
    chainId,
    isPlume,
    networkLabel: isPlume ? 'Plume mainnet (98866)' : 'Base mainnet (8453)',
    hasDeployKey,
    hasTreasury,
    hasOperator,
    hasRpc,
    hasUsdc,
    centrifugeReady,
    operatorMatchesDeploy,
    treasuryDistinct,
    canDeployOnChain,
    productionReady: canDeployOnChain && hasUsdc
  };
}

export function listManualTasks(env) {
  const tasks = [];

  const readiness = evaluateTokenIssuanceReadiness(env);

  for (const group of MANUAL_TASK_GROUPS) {
    if (group.id === 'explorer' && readiness.isPlume) continue;
    const missing = group.keys.filter((key) => {
      if (key === 'TOKEN_DEPLOY_PRIVATE_KEY' && env.PRIVATE_KEY?.trim()) return false;
      return !env[key]?.trim();
    });
    if (missing.length > 0) {
      tasks.push({ ...group, missing });
    }
  }

  if (hasDeployKey(env) && !readiness.operatorMatchesDeploy) {
    tasks.push({
      id: 'operator_mismatch',
      label: 'Alinear operador con wallet de deploy',
      missing: ['RWA_OPERATOR_ADDRESS'],
      hint: 'RWA_OPERATOR_ADDRESS debe ser la address de TOKEN_DEPLOY_PRIVATE_KEY.'
    });
  }

  if (readiness.hasDeployKey) {
    tasks.push({
      id: 'fund_gas',
      label: `Fondear gas en ${readiness.networkLabel}`,
      missing: ['(manual)'],
      hint: readiness.isPlume
        ? 'Enviar PLUME a la wallet de deploy.'
        : 'Enviar ETH en Base a la wallet de deploy.'
    });
  }

  if (readiness.canDeployOnChain && !readiness.centrifugeReady) {
    tasks.push({
      id: 'centrifuge_checklist',
      label: 'Checklist legal Centrifuge por proyecto',
      missing: ['(admin UI)'],
      hint: 'SPV, auditoría, NAV oracle, KYC — en Admin → Lanzamiento → Checklist Centrifuge.'
    });
  }

  return tasks;
}
