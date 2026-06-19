import { Contract, ContractFactory, JsonRpcProvider, type Signer, keccak256, toUtf8Bytes } from 'ethers';
import SanovaNavOracleArtifact from './artifacts/SanovaNavOracle.json';
import { fixedUsdPriceToMorphoOraclePrice } from './pricingOracleValidation';
import { resolveMorphoChainId } from './explorerUrls';
import { isRwaOperatorConfigured, resolveRwaOperatorSigner } from './rwaOperatorSigner';

export type DeployNavOracleResult =
  | { status: 'DEPLOYED'; oracleAddress: string; txHash: string }
  | { status: 'SKIPPED'; reason: string };

export type UpdateNavOracleResult =
  | { status: 'UPDATED'; txHash: string; navPerAssetMicroUsd: bigint }
  | { status: 'SKIPPED'; reason: string };

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return (
      process.env.LENDING_BASE_RPC_URL?.trim() ||
      process.env.BASE_RPC_URL?.trim() ||
      'https://mainnet.base.org'
    );
  }
  if (chainId === 84532) {
    return process.env.BASE_SEPOLIA_RPC_URL?.trim() || 'https://sepolia.base.org';
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

export function usdPriceToNavPerAssetMicroUsd(pricePerTokenUsd: number): bigint | null {
  if (!Number.isFinite(pricePerTokenUsd) || pricePerTokenUsd <= 0) {
    return null;
  }
  return BigInt(Math.round(pricePerTokenUsd * 1_000_000));
}

export function auditDocumentToHash(documentId: string): string {
  return keccak256(toUtf8Bytes(documentId.trim()));
}

export async function deployNavOracleForVault(
  vaultAddress: string,
  pricePerTokenUsd: number,
  options?: { updaterAddress?: string; ownerAddress?: string }
): Promise<DeployNavOracleResult> {
  if (!isRwaOperatorConfigured()) {
    return { status: 'SKIPPED', reason: 'Operador RWA no configurado para desplegar oracle NAV.' };
  }

  const navPerAssetMicroUsd = usdPriceToNavPerAssetMicroUsd(pricePerTokenUsd);
  if (!navPerAssetMicroUsd) {
    return { status: 'SKIPPED', reason: 'pricePerToken inválido para oracle NAV.' };
  }

  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const wallet = await resolveRwaOperatorSigner(provider, chainId);
  if (!wallet) {
    return { status: 'SKIPPED', reason: 'No se pudo resolver el operador RWA.' };
  }

  try {
    const walletAddress = await wallet.getAddress();
    const gasBalance = await provider.getBalance(walletAddress);
    if (gasBalance <= 0n) {
      return { status: 'SKIPPED', reason: `Wallet ${walletAddress} sin gas en chain ${chainId}.` };
    }

    const updater =
      options?.updaterAddress?.trim() ||
      process.env.NAV_ORACLE_UPDATER_ADDRESS?.trim() ||
      walletAddress;
    const owner =
      options?.ownerAddress?.trim() ||
      process.env.TOKEN_TREASURY_ADDRESS?.trim() ||
      walletAddress;

    const factory = new ContractFactory(
      SanovaNavOracleArtifact.abi,
      SanovaNavOracleArtifact.bytecode,
      wallet
    );
    const oracle = await factory.deploy(vaultAddress, navPerAssetMicroUsd, updater, owner);
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    const deployTx = oracle.deploymentTransaction();
    return {
      status: 'DEPLOYED',
      oracleAddress,
      txHash: deployTx?.hash ?? 'unknown'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nav oracle deploy failed';
    return { status: 'SKIPPED', reason: message };
  } finally {
    provider.destroy();
  }
}

export async function updateNavOraclePrice(
  oracleAddress: string,
  pricePerTokenUsd: number,
  auditDocumentId: string
): Promise<UpdateNavOracleResult> {
  if (!isRwaOperatorConfigured()) {
    return { status: 'SKIPPED', reason: 'Operador RWA no configurado para actualizar NAV.' };
  }

  const navPerAssetMicroUsd = usdPriceToNavPerAssetMicroUsd(pricePerTokenUsd);
  if (!navPerAssetMicroUsd) {
    return { status: 'SKIPPED', reason: 'pricePerToken inválido.' };
  }

  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const wallet = await resolveRwaOperatorSigner(provider, chainId);
  if (!wallet) {
    return { status: 'SKIPPED', reason: 'No se pudo resolver el operador RWA.' };
  }

  try {
    const oracle = new Contract(
      oracleAddress,
      [
        'function updateNav(uint256 navPerAssetMicroUsd_, bytes32 auditHash)',
        'function price() view returns (uint256)'
      ],
      wallet
    );
    const auditHash = auditDocumentToHash(auditDocumentId);
    const tx = await oracle.updateNav(navPerAssetMicroUsd, auditHash);
    const receipt = await tx.wait();
    return {
      status: 'UPDATED',
      txHash: receipt?.hash ?? tx.hash,
      navPerAssetMicroUsd
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nav update failed';
    return { status: 'SKIPPED', reason: message };
  } finally {
    provider.destroy();
  }
}

/** Compare on-chain NAV oracle price with expected fixed price (within tolerance). */
export async function validateNavOraclePrice(
  oracleAddress: string,
  pricePerTokenUsd: number,
  vaultAddress?: string
): Promise<{ ok: boolean; message: string; onChainPrice?: bigint; expectedPrice?: bigint }> {
  const expected = fixedUsdPriceToMorphoOraclePrice(pricePerTokenUsd);
  if (!expected) {
    return { ok: false, message: 'Precio esperado inválido.' };
  }

  const chainId = resolveMorphoChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));

  try {
    const oracle = new Contract(
      oracleAddress,
      [
        'function price() view returns (uint256)',
        'function vault() view returns (address)',
        'function navPerAssetMicroUsd() view returns (uint256)',
        'function lastNavUpdateAt() view returns (uint256)',
        'function lastAuditHash() view returns (bytes32)'
      ],
      provider
    );

    const onChainPrice = BigInt(await oracle.price());
    const toleranceBps = Number(process.env.MORPHO_ORACLE_TOLERANCE_BPS ?? '100');
    const diff = onChainPrice > expected ? onChainPrice - expected : expected - onChainPrice;
    const withinTolerance = diff * 10_000n <= expected * BigInt(toleranceBps);

    if (vaultAddress) {
      const linkedVault = (await oracle.vault()) as string;
      if (linkedVault.toLowerCase() !== vaultAddress.toLowerCase()) {
        return { ok: false, message: 'Oracle vault no coincide con el vault del proyecto.' };
      }
    }

    return {
      ok: withinTolerance,
      onChainPrice,
      expectedPrice: expected,
      message: withinTolerance
        ? `Oracle NAV OK. price=${onChainPrice}, navPerAsset=${await oracle.navPerAssetMicroUsd()}.`
        : `Oracle NAV diverge: on-chain ${onChainPrice}, esperado ${expected}.`
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo leer oracle NAV.'
    };
  } finally {
    provider.destroy();
  }
}

export function shouldUseNavOracle(): boolean {
  const type = (process.env.MORPHO_ORACLE_TYPE ?? 'nav').trim().toLowerCase();
  return type !== 'fixed';
}
