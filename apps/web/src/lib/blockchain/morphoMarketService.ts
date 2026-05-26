import { Contract, ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import { resolveChainId } from './explorerUrls';
import SanovaFixedPriceOracleArtifact from './artifacts/SanovaFixedPriceOracle.json';
import {
  buildDefaultMorphoMarketParams,
  morphoMarketId,
  prepareMorphoCreateMarket,
  type MorphoMarketParams
} from '../lending/protocols/morphoBorrow';
import { waitForAutomationTx } from './automationTx';
import { getLendingChainConfig } from '../lending/baseContracts';

export type CreateMorphoMarketResult =
  | {
      status: 'CREATED';
      marketId: string;
      txHash: string;
      chainId: number;
      params: MorphoMarketParams;
    }
  | { status: 'SKIPPED'; reason: string };

const MORPHO_PRICE_SCALE_DECIMALS = 24n; // 1e36 scale adjusted for 18-dec collateral and 6-dec USDC.

function resolvePrivateKey(): string | null {
  const key = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  return key || null;
}

function resolveRpcUrl(chainId: number): string {
  if (chainId === 84532) {
    return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

function fixedUsdPriceToMorphoOraclePrice(pricePerTokenUsd: number): bigint | null {
  if (!Number.isFinite(pricePerTokenUsd) || pricePerTokenUsd <= 0) {
    return null;
  }

  const microUsd = BigInt(Math.round(pricePerTokenUsd * 1_000_000));
  return microUsd * 10n ** (MORPHO_PRICE_SCALE_DECIMALS - 6n);
}

async function deployFixedPriceOracle(wallet: Wallet, pricePerTokenUsd: number): Promise<string | null> {
  const oraclePrice = fixedUsdPriceToMorphoOraclePrice(pricePerTokenUsd);
  if (!oraclePrice) {
    return null;
  }

  const oracleFactory = new ContractFactory(
    SanovaFixedPriceOracleArtifact.abi,
    SanovaFixedPriceOracleArtifact.bytecode,
    wallet
  );
  const oracle = await oracleFactory.deploy(oraclePrice);
  await oracle.waitForDeployment();
  return oracle.getAddress();
}

export async function createMorphoMarketForVault(
  vaultAddress: string,
  pricePerTokenUsd: number
): Promise<CreateMorphoMarketResult> {
  const privateKey = resolvePrivateKey();
  if (!privateKey) {
    return {
      status: 'SKIPPED',
      reason: 'TOKEN_DEPLOY_PRIVATE_KEY requerida para crear mercado Morpho.'
    };
  }

  const chainId = resolveChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const wallet = new Wallet(privateKey, provider);

  try {
    const gasBalance = await provider.getBalance(wallet.address);
    if (gasBalance <= 0n) {
      return { status: 'SKIPPED', reason: `La wallet de deploy ${wallet.address} no tiene gas en chain ${chainId}.` };
    }

    const oracleAddress =
      process.env.MORPHO_ORACLE_ADDRESS?.trim() || (await deployFixedPriceOracle(wallet, pricePerTokenUsd));
    if (!oracleAddress) {
      return {
        status: 'SKIPPED',
        reason: 'No se pudo crear oracle Morpho: pricePerToken inválido.'
      };
    }

    const params = buildDefaultMorphoMarketParams(vaultAddress, oracleAddress);
    if (!params) {
      return {
        status: 'SKIPPED',
        reason: 'No se pudieron construir parámetros Morpho para el vault.'
      };
    }

    const prepared = prepareMorphoCreateMarket(params);
    const tx = await wallet.sendTransaction({
      to: prepared.to,
      data: prepared.data,
      value: 0n
    });
    const receipt = await waitForAutomationTx(tx);
    const morpho = new Contract(
      getLendingChainConfig().morpho,
      ['function idToMarketParams(bytes32 id) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)'],
      provider
    );
    const marketId = morphoMarketId(params);
    const stored = await morpho.idToMarketParams(marketId);
    if (stored?.collateralToken && stored.collateralToken.toLowerCase() !== params.collateralToken.toLowerCase()) {
      return { status: 'SKIPPED', reason: 'Morpho market verification failed after createMarket.' };
    }

    return {
      status: 'CREATED',
      marketId,
      txHash: receipt?.hash ?? tx.hash,
      chainId,
      params
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Morpho market error';
    return { status: 'SKIPPED', reason: message };
  } finally {
    provider.destroy();
  }
}
