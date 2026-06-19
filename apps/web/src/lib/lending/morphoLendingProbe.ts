import { Contract, JsonRpcProvider } from 'ethers';
import { getLendingChainConfig, METAMORPHO_FACTORY_ADDRESS } from './baseContracts';
import { resolveMorphoChainId } from '../blockchain/explorerUrls';
import { getStablecoinNetwork } from '../payments/stablecoinNetworks';
import { isRwaOperatorConfigured } from '../blockchain/rwaOperatorSigner';

export type MorphoLendingProbeResult = {
  ok: boolean;
  chainId: number;
  rpcReachable: boolean;
  morphoCoreConfigured: boolean;
  metamorphoVaultConfigured: boolean;
  metamorphoVaultValid: boolean | null;
  treasuryBaseUsdcConfigured: boolean;
  deployKeyConfigured: boolean;
  oracleConfigured: boolean;
  seedLiquidityUsdc: number | null;
  issues: string[];
  recommendations: string[];
};

function resolveRpcUrl(): string {
  return (
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    process.env.BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

export async function probeMorphoLending(): Promise<MorphoLendingProbeResult> {
  const config = getLendingChainConfig();
  const chainId = resolveMorphoChainId();
  const issues: string[] = [];
  const recommendations: string[] = [];

  const vaultAddress = process.env.METAMORPHO_VAULT_ADDRESS?.trim() || null;
  const deployKey = isRwaOperatorConfigured();
  const oracleAddress = process.env.MORPHO_ORACLE_ADDRESS?.trim() || null;
  const seedRaw = Number(process.env.MORPHO_SEED_LIQUIDITY_USDC ?? process.env.METAMORPHO_SEED_USDC);
  const seedLiquidityUsdc = Number.isFinite(seedRaw) && seedRaw > 0 ? seedRaw : null;

  const baseNetwork = getStablecoinNetwork('BASE');
  const treasuryConfigured = Boolean(baseNetwork.treasuryAddress && baseNetwork.tokenAddress);

  if (!treasuryConfigured) {
    issues.push('BASE_STABLECOIN_TREASURY_ADDRESS o BASE_USDC_TOKEN_ADDRESS no configurados.');
  }
  if (!deployKey) {
    issues.push('PRIVY_OPERATOR_WALLET_ID + RWA_OPERATOR_ADDRESS o TOKEN_DEPLOY_PRIVATE_KEY no configurados.');
  }
  if (!vaultAddress) {
    issues.push('METAMORPHO_VAULT_ADDRESS no configurado.');
    recommendations.push('Ejecutá scripts/setup-anelo-morpho-metamorpho.ts o deployMetaMorphoVault().');
  }
  if (!oracleAddress && process.env.MORPHO_ORACLE_TYPE !== 'nav') {
    recommendations.push('Configurá MORPHO_ORACLE_ADDRESS o MORPHO_ORACLE_TYPE=nav.');
  }
  if (!seedLiquidityUsdc) {
    recommendations.push('Definí MORPHO_SEED_LIQUIDITY_USDC para liquidez inicial.');
  }

  let rpcReachable = false;
  let metamorphoVaultValid: boolean | null = null;

  try {
    const provider = new JsonRpcProvider(resolveRpcUrl(), chainId);
    await provider.getBlockNumber();
    rpcReachable = true;

    if (vaultAddress) {
      const factory = new Contract(
        METAMORPHO_FACTORY_ADDRESS,
        ['function isMetaMorpho(address) view returns (bool)'],
        provider
      );
      metamorphoVaultValid = await factory.isMetaMorpho(vaultAddress);
      if (!metamorphoVaultValid) {
        issues.push(`METAMORPHO_VAULT_ADDRESS ${vaultAddress} no es un vault MetaMorpho válido.`);
      }
    }

    provider.destroy();
  } catch (error) {
    issues.push(`RPC Base no accesible: ${error instanceof Error ? error.message : 'RPC_ERROR'}`);
  }

  const morphoCoreConfigured = Boolean(config.morpho && config.usdc && config.morphoIrm);
  const ok =
    rpcReachable &&
    morphoCoreConfigured &&
    treasuryConfigured &&
    Boolean(vaultAddress) &&
    metamorphoVaultValid === true &&
    deployKey;

  return {
    ok,
    chainId,
    rpcReachable,
    morphoCoreConfigured,
    metamorphoVaultConfigured: Boolean(vaultAddress),
    metamorphoVaultValid,
    treasuryBaseUsdcConfigured: treasuryConfigured,
    deployKeyConfigured: deployKey,
    oracleConfigured: Boolean(oracleAddress) || process.env.MORPHO_ORACLE_TYPE === 'nav',
    seedLiquidityUsdc,
    issues,
    recommendations
  };
}
