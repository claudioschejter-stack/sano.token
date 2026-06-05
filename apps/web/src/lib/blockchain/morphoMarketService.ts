import { Contract, ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import { resolveMorphoChainId } from './explorerUrls';
import SanovaFixedPriceOracleArtifact from './artifacts/SanovaFixedPriceOracle.json';
import {
  buildDefaultMorphoMarketParams,
  morphoMarketId,
  prepareMorphoCreateMarket,
  type MorphoMarketParams
} from '../lending/protocols/morphoBorrow';
import { waitForAutomationTx } from './automationTx';
import { getLendingChainConfig } from '../lending/baseContracts';
import { fixedUsdPriceToMorphoOraclePrice } from './pricingOracleValidation';

export type CreateMorphoMarketResult =
  | {
      status: 'CREATED';
      marketId: string;
      txHash: string;
      chainId: number;
      params: MorphoMarketParams;
    }
  | { status: 'SKIPPED'; reason: string };

function resolvePrivateKey(): string | null {
  const key = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  return key || null;
}

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return (
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
    );
  }
  if (chainId === 84532) {
    return process.env.BASE_SEPOLIA_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
  }
  return process.env.LENDING_BASE_RPC_URL?.trim() || process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
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

  const chainId = resolveMorphoChainId();
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
    const morpho = new Contract(
      getLendingChainConfig().morpho,
      [
        'function createMarket((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams)',
        'function idToMarketParams(bytes32 id) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)'
      ],
      wallet
    );
    const marketId = morphoMarketId(params);
    const existing = await morpho.idToMarketParams(marketId);
    const existingCollateral = (existing?.collateralToken ?? existing?.[1] ?? '') as string;
    if (
      existingCollateral &&
      existingCollateral.toLowerCase() !== '0x0000000000000000000000000000000000000000' &&
      existingCollateral.toLowerCase() === params.collateralToken.toLowerCase()
    ) {
      return {
        status: 'CREATED',
        marketId,
        txHash: 'existing-market',
        chainId,
        params
      };
    }

    try {
      await morpho.createMarket.staticCall([
        params.loanToken,
        params.collateralToken,
        params.oracle,
        params.irm,
        params.lltv
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'createMarket simulation failed';
      return { status: 'SKIPPED', reason: message };
    }

    const tx = await morpho.createMarket([
      params.loanToken,
      params.collateralToken,
      params.oracle,
      params.irm,
      params.lltv
    ]);
    const receipt = await waitForAutomationTx(tx);
    let storedCollateral = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const stored = await morpho.idToMarketParams(marketId);
      storedCollateral = (stored?.collateralToken ?? stored?.[1] ?? '') as string;
      if (
        storedCollateral &&
        storedCollateral.toLowerCase() !== '0x0000000000000000000000000000000000000000'
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const empty =
      !storedCollateral || storedCollateral.toLowerCase() === '0x0000000000000000000000000000000000000000';
    if (empty) {
      return {
        status: 'SKIPPED',
        reason: `Morpho market not created (tx ${receipt?.hash ?? tx.hash}).`
      };
    }
    if (storedCollateral.toLowerCase() !== params.collateralToken.toLowerCase()) {
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
