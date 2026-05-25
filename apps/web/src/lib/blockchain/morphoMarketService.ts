import { JsonRpcProvider, Wallet } from 'ethers';
import { resolveChainId } from './explorerUrls';
import {
  buildDefaultMorphoMarketParams,
  morphoMarketId,
  prepareMorphoCreateMarket,
  type MorphoMarketParams
} from '../lending/protocols/morphoBorrow';

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
  if (chainId === 84532) {
    return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

export async function createMorphoMarketForVault(vaultAddress: string): Promise<CreateMorphoMarketResult> {
  const params = buildDefaultMorphoMarketParams(vaultAddress);
  if (!params) {
    return {
      status: 'SKIPPED',
      reason:
        'Configurá MORPHO_ORACLE_ADDRESS (oracle de precio del vault) y opcionalmente MORPHO_DEFAULT_LLTV_BPS.'
    };
  }

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
    const prepared = prepareMorphoCreateMarket(params);
    const tx = await wallet.sendTransaction({
      to: prepared.to,
      data: prepared.data,
      value: 0n
    });
    const receipt = await tx.wait();

    return {
      status: 'CREATED',
      marketId: morphoMarketId(params),
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
