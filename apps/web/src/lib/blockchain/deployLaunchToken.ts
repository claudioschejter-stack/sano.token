import { Contract, ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import type { TokenStandard, TokenInstrumentType, VaultFundingStatus } from '../admin/launchTypes';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import { deployAssetToken as deployThirdwebDemo, resolveChainId } from './deployAssetToken';
import { waitForAutomationTx } from './automationTx';
import { resolveTreasuryAddress } from './treasuryPolicy';
import { transferOwnershipToTreasury, type OwnershipTransferResult } from './ownershipTransfer';
import { configureInitialContractSecurity } from './securityPolicy';

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
      vaultFundingStatus?: VaultFundingStatus;
      vaultFundingAmount?: string | null;
      vaultFundingTxHash?: string | null;
      vaultFundingError?: string | null;
      chainId: number;
      txHash: string;
      ownershipTransfers?: OwnershipTransferResult[];
      security?: { allowedContracts: string[] };
    }
  | { status: 'SKIPPED'; reason: string };

type VaultFundingResult = {
  status: VaultFundingStatus;
  amount: string | null;
  txHash: string | null;
  error: string | null;
};

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

async function fundVaultWithDeployerBalance(input: {
  asset: Contract;
  vaultContract: Contract;
  walletAddress: string;
  receiverAddress: string;
  vaultAddress: string;
  amount: bigint;
}): Promise<VaultFundingResult> {
  try {
    const deployerKyc = await input.asset.kycApproved(input.walletAddress);
    if (!deployerKyc) {
      const setKycTx = await input.asset.setKyc(input.walletAddress, true);
      await waitForAutomationTx(setKycTx);
    }
    if (input.receiverAddress.toLowerCase() !== input.walletAddress.toLowerCase()) {
      const receiverKyc = await input.asset.kycApproved(input.receiverAddress);
      if (!receiverKyc) {
        const setReceiverKycTx = await input.asset.setKyc(input.receiverAddress, true);
        await waitForAutomationTx(setReceiverKycTx);
      }
    }

    const vaultKyc = await input.asset.kycApproved(input.vaultAddress);
    if (!vaultKyc) {
      const setVaultKycTx = await input.asset.setKyc(input.vaultAddress, true);
      await waitForAutomationTx(setVaultKycTx);
    }

    const approveTx = await input.asset.approve(input.vaultAddress, input.amount);
    await waitForAutomationTx(approveTx);

    const vaultAllowed = await input.asset.externalContractAllowed(input.vaultAddress);
    if (!vaultAllowed) {
      const allowVaultTx = await input.asset.setExternalContractAllowed(input.vaultAddress, true);
      await waitForAutomationTx(allowVaultTx);
    }

    if (input.receiverAddress.toLowerCase() !== input.walletAddress.toLowerCase()) {
      const receiverAllowed = await input.vaultContract.externalContractAllowed(input.receiverAddress);
      if (!receiverAllowed) {
        const allowReceiverTx = await input.vaultContract.setExternalContractAllowed(
          input.receiverAddress,
          true
        );
        await waitForAutomationTx(allowReceiverTx);
      }
    }

    const depositTx = await input.vaultContract.deposit(input.amount, input.receiverAddress);
    const depositReceipt = await waitForAutomationTx(depositTx);
    const totalAssets = await input.vaultContract.totalAssets();
    const shares = await input.vaultContract.balanceOf(input.receiverAddress);

    if (totalAssets >= input.amount && shares > 0n) {
      return {
        status: 'FUNDED',
        amount: input.amount.toString(),
        txHash: depositReceipt?.hash ?? depositTx.hash,
        error: null
      };
    }

    return {
      status: 'FAILED',
      amount: null,
      txHash: depositReceipt?.hash ?? depositTx.hash,
      error: 'Vault deposit completed but totalAssets/share balance did not verify.'
    };
  } catch (error) {
    return {
      status: 'FAILED',
      amount: null,
      txHash: null,
      error: error instanceof Error ? error.message : 'Vault deposit failed'
    };
  }
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
    const gasBalance = await provider.getBalance(wallet.address);
    if (gasBalance <= 0n) {
      provider.destroy();
      return { status: 'SKIPPED', reason: `La wallet de deploy ${wallet.address} no tiene gas en chain ${chainId}.` };
    }

    const tokenName = buildOnChainTokenName(input.tokenName, input.tokenInstrumentType);
    const symbol = normalizeSymbol(input.tokenSymbol);
    const treasuryAddress = resolveTreasuryAddress(input.treasuryAddress ?? wallet.address) ?? wallet.address;
    const mintRecipient = input.tokenStandard === 'ERC4626' ? wallet.address : treasuryAddress;
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
      await waitForAutomationTx(setKycTx);
    }

    const mintTx = await asset.mint(mintRecipient, mintAmount);
    const mintReceipt = await waitForAutomationTx(mintTx);

    if (input.tokenStandard === 'SANOVA_KYC') {
      const security = await configureInitialContractSecurity({
        asset,
        treasuryAddress,
        totalAssets: mintAmount
      });
      const ownershipTransfers = [
        await transferOwnershipToTreasury({
          contractName: 'SanovaAssetToken',
          contract: asset,
          contractAddress,
          deployerAddress: wallet.address,
          treasuryAddress
        })
      ];
      return {
        status: 'DEPLOYED',
        contractAddress,
        chainId,
        txHash: mintReceipt?.hash ?? 'mint-submitted',
        ownershipTransfers,
        security
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
    const funding = await fundVaultWithDeployerBalance({
      asset,
      vaultContract,
      walletAddress: wallet.address,
      receiverAddress: treasuryAddress,
      vaultAddress,
      amount: mintAmount
    });
    const security = await configureInitialContractSecurity({
      asset,
      vaultContract,
      treasuryAddress,
      totalAssets: mintAmount,
      extraAllowedContracts: [vaultAddress]
    });
    const ownershipTransfers = [
      await transferOwnershipToTreasury({
        contractName: 'SanovaAssetToken',
        contract: asset,
        contractAddress,
        deployerAddress: wallet.address,
        treasuryAddress
      }),
      await transferOwnershipToTreasury({
        contractName: 'SanovaRwaVault',
        contract: vaultContract,
        contractAddress: vaultAddress,
        deployerAddress: wallet.address,
        treasuryAddress
      })
    ];

    return {
      status: 'DEPLOYED',
      contractAddress,
      vaultAddress,
      vaultFundingStatus: funding.status,
      vaultFundingAmount: funding.amount,
      vaultFundingTxHash: funding.txHash,
      vaultFundingError: funding.error,
      chainId,
      txHash: funding.txHash ?? mintReceipt?.hash ?? 'deploy-submitted',
      ownershipTransfers,
      security
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
