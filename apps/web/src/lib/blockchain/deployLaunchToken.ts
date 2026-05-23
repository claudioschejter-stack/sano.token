import { Contract, ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import type { TokenStandard, TokenInstrumentType } from '../admin/launchTypes';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import { deployAssetToken as deployThirdwebDemo, resolveChainId } from './deployAssetToken';

export type DeployLaunchTokenInput = {
  tokenStandard: TokenStandard;
  tokenInstrumentType?: TokenInstrumentType;
  tokenName: string;
  tokenSymbol: string;
  totalSupplyUnits: number;
  treasuryAddress?: string;
};

function buildOnChainTokenName(name: string, instrumentType?: TokenInstrumentType): string {
  const base = name.trim();
  const suffix = instrumentType === 'DEBT' ? ' Debt Note' : instrumentType === 'EQUITY' ? ' Equity' : '';
  return `${base}${suffix}`.slice(0, 64);
}

export type DeployLaunchTokenResult =
  | {
      status: 'DEPLOYED';
      contractAddress: string;
      vaultAddress?: string;
      chainId: number;
      txHash: string;
    }
  | { status: 'SKIPPED'; reason: string };

function normalizeSymbol(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.slice(0, 8) || 'RWA';
}

function resolvePrivateKey(): string | null {
  const key = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  return key || null;
}

function resolveRpcUrl(chainId: number): string {
  if (chainId === 84532 || chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || (chainId === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org');
  }

  if (chainId === 80002 || chainId === 137) {
    return process.env.POLYGON_RPC_URL?.trim() || (chainId === 80002 ? 'https://rpc-amoy.polygon.technology' : 'https://polygon-rpc.com');
  }

  if (chainId === 11155111) {
    return process.env.ETHEREUM_RPC_URL?.trim() || 'https://rpc.sepolia.org';
  }

  return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
}

async function deploySanovaContracts(input: DeployLaunchTokenInput): Promise<DeployLaunchTokenResult> {
  const privateKey = resolvePrivateKey();
  const chainId = resolveChainId();

  if (!privateKey) {
    return {
      status: 'SKIPPED',
      reason: 'Configurá TOKEN_DEPLOY_PRIVATE_KEY o PRIVATE_KEY con una wallet con gas en testnet (Base Sepolia recomendada).'
    };
  }

  if (!Number.isInteger(input.totalSupplyUnits) || input.totalSupplyUnits <= 0) {
    return { status: 'SKIPPED', reason: 'Supply de tokens inválido para la emisión.' };
  }

  try {
    const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
    const wallet = new Wallet(privateKey, provider);
    const tokenName = buildOnChainTokenName(input.tokenName, input.tokenInstrumentType);
    const symbol = normalizeSymbol(input.tokenSymbol);
    const mintRecipient = input.treasuryAddress ?? wallet.address;
    const mintAmount = BigInt(input.totalSupplyUnits) * 10n ** 18n;

    const assetFactory = new ContractFactory(
      SanovaAssetTokenArtifact.abi,
      SanovaAssetTokenArtifact.bytecode,
      wallet
    );

    const assetToken = await assetFactory.deploy(tokenName, symbol, wallet.address);
    await assetToken.waitForDeployment();
    const contractAddress = await assetToken.getAddress();
    const asset = new Contract(contractAddress, SanovaAssetTokenArtifact.abi, wallet);

    if (mintRecipient.toLowerCase() !== wallet.address.toLowerCase()) {
      const setKycTx = await asset.setKyc(mintRecipient, true);
      await setKycTx.wait();
    }

    const mintTx = await asset.mint(mintRecipient, mintAmount);
    const mintReceipt = await mintTx.wait();

    if (input.tokenStandard === 'SANOVA_KYC') {
      return {
        status: 'DEPLOYED',
        contractAddress,
        chainId,
        txHash: mintReceipt?.hash ?? 'mint-submitted'
      };
    }

    const vaultName = `${tokenName} Vault`.slice(0, 64);
    const vaultSymbol = `v${symbol}`.slice(0, 8);

    const vaultFactory = new ContractFactory(
      SanovaRwaVaultArtifact.abi,
      SanovaRwaVaultArtifact.bytecode,
      wallet
    );

    const vault = await vaultFactory.deploy(contractAddress, vaultName, vaultSymbol, wallet.address);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    const vaultContract = new Contract(vaultAddress, SanovaRwaVaultArtifact.abi, wallet);

    if (mintRecipient.toLowerCase() === wallet.address.toLowerCase()) {
      const approveTx = await asset.approve(vaultAddress, mintAmount);
      await approveTx.wait();

      const depositTx = await vaultContract.deposit(mintAmount, wallet.address);
      const depositReceipt = await depositTx.wait();

      return {
        status: 'DEPLOYED',
        contractAddress,
        vaultAddress,
        chainId,
        txHash: depositReceipt?.hash ?? mintReceipt?.hash ?? 'deploy-submitted'
      };
    }

    return {
      status: 'DEPLOYED',
      contractAddress,
      vaultAddress,
      chainId,
      txHash: mintReceipt?.hash ?? 'deploy-submitted'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown deployment error';
    return { status: 'SKIPPED', reason: `Sanova contracts: ${message}` };
  }
}

export async function deployLaunchToken(input: DeployLaunchTokenInput): Promise<DeployLaunchTokenResult> {
  if (input.tokenStandard === 'THIRDWEB_DEMO') {
    const result = await deployThirdwebDemo({
      tokenName: input.tokenName,
      tokenSymbol: input.tokenSymbol,
      totalSupplyUnits: input.totalSupplyUnits,
      treasuryAddress: input.treasuryAddress
    });

    if (result.status === 'DEPLOYED') {
      return {
        status: 'DEPLOYED',
        contractAddress: result.contractAddress,
        chainId: result.chainId,
        txHash: result.txHash
      };
    }

    return { status: 'SKIPPED', reason: result.reason };
  }

  return deploySanovaContracts(input);
}
