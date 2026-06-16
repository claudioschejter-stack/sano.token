import { Contract, JsonRpcProvider, Wallet, MaxUint256, id, getAddress } from 'ethers';
import { getLendingChainConfig } from './baseContracts';
import type { MorphoMarketParams } from './protocols/morphoBorrow';
import { morphoMarketId } from './protocols/morphoBorrow';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';

import { METAMORPHO_FACTORY_ADDRESS } from './baseContracts';

const METAMORPHO_FACTORY_ABI = [
  'function createMetaMorpho(address initialOwner, uint256 initialTimelock, address asset, string name, string symbol, bytes32 salt) returns (address)',
  'function isMetaMorpho(address) view returns (bool)'
];

const METAMORPHO_VAULT_ABI = [
  'function submitCap((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams, uint256 newSupplyCap)',
  'function acceptCap((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams)',
  'function reallocate((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv marketParams, uint256 assets)[] allocations)',
  'function supplyQueue(uint256) view returns (bytes32)',
  'function config(bytes32 id) view returns (uint184 cap, bool enabled, uint64 removableAt)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

const METAMORPHO_DEPOSIT_ABI = [
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)'
];

export type MetaMorphoSetupResult =
  | {
      status: 'READY';
      vaultAddress: string;
      marketId: string;
      txHashes: string[];
      poolUrl: string;
    }
  | { status: 'SKIPPED'; reason: string };

function resolvePrivateKey(): string | null {
  return (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim() || null;
}

function resolveRpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

function marketParamsTuple(params: MorphoMarketParams) {
  return [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv];
}

function resolveMetaMorphoVaultAddress(): string | null {
  return process.env.METAMORPHO_VAULT_ADDRESS?.trim() || null;
}

function resolveSupplyCapUsdc(): bigint {
  const raw = Number(process.env.METAMORPHO_SUPPLY_CAP_USDC ?? process.env.MORPHO_SEED_LIQUIDITY_USDC ?? '500');
  const usdc = Number.isFinite(raw) && raw > 0 ? raw : 500;
  return BigInt(Math.floor(usdc * 1_000_000));
}

/** Deploy a dedicated MetaMorpho USDC vault for institutional lenders (if not already configured). */
export async function deployMetaMorphoVault(options?: {
  name?: string;
  symbol?: string;
  timelockSeconds?: number;
}): Promise<{ status: 'DEPLOYED'; vaultAddress: string; txHash: string } | { status: 'SKIPPED'; reason: string }> {
  const existing = resolveMetaMorphoVaultAddress();
  if (existing) {
    return { status: 'SKIPPED', reason: `METAMORPHO_VAULT_ADDRESS ya configurado: ${existing}` };
  }

  const privateKey = resolvePrivateKey();
  if (!privateKey) {
    return { status: 'SKIPPED', reason: 'TOKEN_DEPLOY_PRIVATE_KEY requerida.' };
  }

  const provider = new JsonRpcProvider(resolveRpcUrl());
  const wallet = new Wallet(privateKey, provider);
  const { usdc } = getLendingChainConfig();

  try {
    const owner =
      process.env.MORPHO_CURATOR_ADDRESS?.trim() ||
      process.env.TOKEN_TREASURY_ADDRESS?.trim() ||
      wallet.address;
    const timelock = BigInt(options?.timelockSeconds ?? Number(process.env.METAMORPHO_TIMELOCK_SECONDS ?? '0'));
    const name = options?.name ?? process.env.METAMORPHO_VAULT_NAME ?? 'Sanova RWA USDC Vault';
    const symbol = options?.symbol ?? process.env.METAMORPHO_VAULT_SYMBOL ?? 'srUSDC';
    const salt = id(`sanova-metamorpho-${resolveMorphoChainId()}-${name}`);

    const factory = new Contract(METAMORPHO_FACTORY_ADDRESS, METAMORPHO_FACTORY_ABI, wallet);
    const tx = await factory.createMetaMorpho(owner, timelock, usdc, name, symbol, salt);
    const receipt = await tx.wait();

    const createLog = receipt?.logs?.find(
      (log: { topics?: string[] }) => log.topics?.[0] === id('CreateMetaMorpho(address,address,address,uint256,address,string,string,bytes32)')
    );
    let vaultAddress: string | null = null;
    if (createLog?.topics?.[1]) {
      vaultAddress = getAddress(`0x${createLog.topics[1].slice(26)}`);
    }

    if (!vaultAddress) {
      return { status: 'SKIPPED', reason: 'MetaMorpho desplegado pero no se pudo parsear la dirección del vault.' };
    }

    return { status: 'DEPLOYED', vaultAddress, txHash: receipt?.hash ?? tx.hash };
  } catch (error) {
    return {
      status: 'SKIPPED',
      reason: error instanceof Error ? error.message : 'MetaMorpho deploy failed'
    };
  } finally {
    provider.destroy();
  }
}

/**
 * Register an isolated Morpho market in MetaMorpho and seed USDC liquidity for institutional lenders.
 * Flow: submitCap → acceptCap (if timelock=0) → deposit USDC → reallocate to market.
 */
export async function setupMetaMorphoForMarket(
  params: MorphoMarketParams,
  options?: { seedUsdc?: number }
): Promise<MetaMorphoSetupResult> {
  const vaultAddress = resolveMetaMorphoVaultAddress();
  if (!vaultAddress) {
    return {
      status: 'SKIPPED',
      reason: 'Configurá METAMORPHO_VAULT_ADDRESS o ejecutá deployMetaMorphoVault primero.'
    };
  }

  const privateKey = resolvePrivateKey();
  if (!privateKey) {
    return { status: 'SKIPPED', reason: 'TOKEN_DEPLOY_PRIVATE_KEY requerida.' };
  }

  const provider = new JsonRpcProvider(resolveRpcUrl());
  const wallet = new Wallet(privateKey, provider);
  const { usdc } = getLendingChainConfig();
  const txHashes: string[] = [];

  try {
    const factory = new Contract(METAMORPHO_FACTORY_ADDRESS, METAMORPHO_FACTORY_ABI, provider);
    const isVault = await factory.isMetaMorpho(vaultAddress);
    if (!isVault) {
      return { status: 'SKIPPED', reason: `${vaultAddress} no es un MetaMorpho vault válido.` };
    }

    const metaMorpho = new Contract(vaultAddress, METAMORPHO_VAULT_ABI, wallet);
    const marketId = morphoMarketId(params);
    const supplyCap = resolveSupplyCapUsdc();
    const tuple = marketParamsTuple(params);

    const config = await metaMorpho.config(marketId);
    const capEnabled = config?.enabled ?? config?.[1] ?? false;

    if (!capEnabled) {
      const submitTx = await metaMorpho.submitCap(tuple, supplyCap);
      const submitReceipt = await submitTx.wait();
      txHashes.push(submitReceipt?.hash ?? submitTx.hash);

      try {
        const acceptTx = await metaMorpho.acceptCap(tuple);
        const acceptReceipt = await acceptTx.wait();
        txHashes.push(acceptReceipt?.hash ?? acceptTx.hash);
      } catch {
        // Timelock pending — cap submitted but not yet accepted.
      }
    }

    const seedTarget = options?.seedUsdc ?? Number(process.env.METAMORPHO_SEED_USDC ?? process.env.MORPHO_SEED_LIQUIDITY_USDC ?? '0');
    if (Number.isFinite(seedTarget) && seedTarget > 0) {
      const usdcContract = new Contract(usdc, ERC20_ABI, wallet);
      const decimals = await usdcContract.decimals();
      const seedAmount = BigInt(Math.floor(seedTarget * 10 ** Number(decimals)));
      const balance = await usdcContract.balanceOf(wallet.address);

      if (balance >= seedAmount) {
        const approveTx = await usdcContract.approve(vaultAddress, MaxUint256);
        await approveTx.wait();

        const vault = new Contract(
          vaultAddress,
          [...METAMORPHO_DEPOSIT_ABI, ...METAMORPHO_VAULT_ABI],
          wallet
        );
        const depositTx = await vault.deposit(seedAmount, wallet.address);
        const depositReceipt = await depositTx.wait();
        txHashes.push(depositReceipt?.hash ?? depositTx.hash);

        const reallocTx = await vault.reallocate([[tuple, seedAmount]]);
        const reallocReceipt = await reallocTx.wait();
        txHashes.push(reallocReceipt?.hash ?? reallocTx.hash);
      }
    }

    return {
      status: 'READY',
      vaultAddress,
      marketId,
      txHashes,
      poolUrl: `https://app.morpho.org/base/vault/${vaultAddress}`
    };
  } catch (error) {
    return {
      status: 'SKIPPED',
      reason: error instanceof Error ? error.message : 'MetaMorpho setup failed'
    };
  } finally {
    provider.destroy();
  }
}

/** Build institutional disclosure payload for MetaMorpho vault listing. */
export function buildMetaMorphoDisclosure(input: {
  projectTitle: string;
  vaultAddress: string;
  rwaVaultAddress: string;
  oracleAddress: string;
  navOracleUrl: string | null;
  marketId: string;
  pricePerTokenUsd: number;
  totalTokens: number;
}) {
  const navTotalUsd = input.totalTokens * input.pricePerTokenUsd;
  return {
    type: 'SANOVA_METAMORPHO_DISCLOSURE',
    version: '1.0',
    project: input.projectTitle,
    vault: {
      metaMorphoAddress: input.vaultAddress,
      asset: 'USDC',
      chainId: resolveMorphoChainId(),
      poolUrl: `https://app.morpho.org/base/vault/${input.vaultAddress}`
    },
    collateral: {
      rwaVault: input.rwaVaultAddress,
      oracle: input.oracleAddress,
      oracleType: 'SANOVA_NAV_ERC4626',
      marketId: input.marketId,
      marketUrl: `https://app.morpho.org/base/market/${input.marketId}`
    },
    nav: {
      url: input.navOracleUrl,
      pricePerTokenUsd: input.pricePerTokenUsd,
      totalNavUsd: navTotalUsd,
      auditModel: 'physical_property_appraisal'
    },
    generatedAt: new Date().toISOString()
  };
}
