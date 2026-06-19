import { Contract, ContractFactory, JsonRpcProvider, type ContractRunner } from 'ethers';
import type { TokenStandard, TokenInstrumentType, VaultFundingStatus } from '../admin/launchTypes';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import { deployAssetToken as deployThirdwebDemo } from './deployAssetToken';
import { resolveProjectDeployChainId } from './projectDeployChain';
import { isVaultTokenStandard } from '../admin/vaultStandards';
import { resolveChainRpcUrl } from './explorerUrls';
import { ensureAutomationSignerReady, sendAutomationTx, waitForAutomationTx } from './automationTx';
import { assertTreasuryVaultSharesReady } from './verifyTreasuryVaultShares';
import { resolveTreasuryAddress } from './treasuryPolicy';
import { transferOwnershipToTreasury, type OwnershipTransferResult } from './ownershipTransfer';
import { configureInitialContractSecurity } from './securityPolicy';
import { isRwaOperatorConfigured, resolveRwaOperatorSigner } from './rwaOperatorSigner';

export type DeployLaunchTokenInput = {
  tokenStandard: TokenStandard;
  tokenInstrumentType?: TokenInstrumentType;
  tokenName: string;
  tokenSymbol: string;
  totalSupplyUnits: number;
  treasuryAddress?: string;
  /** When set (from emission profile), deploy uses this chain instead of TOKEN_DEPLOY_CHAIN_ID only. */
  chainId?: number | null;
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

async function waitForExternalContractAllowed(
  contract: Contract,
  account: string,
  timeoutMs = 30_000
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await contract.externalContractAllowed(account)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`externalContractAllowed(${account}) no quedó activo a tiempo.`);
}

async function ensureExternalContractAllowed(
  contract: Contract,
  account: string,
  wallet: ContractRunner | null
): Promise<void> {
  if (await contract.externalContractAllowed(account)) {
    return;
  }

  await contract.setExternalContractAllowed.staticCall(account, true);
  const tx = await sendAutomationTx(() => contract.setExternalContractAllowed(account, true), wallet);
  await waitForAutomationTx(tx);
  await waitForExternalContractAllowed(contract, account);
}

async function transferVaultSharesToTreasury(input: {
  asset: Contract;
  vaultContract: Contract;
  walletAddress: string;
  treasuryAddress: string;
  wallet: ContractRunner | null;
}): Promise<void> {
  if (input.walletAddress.toLowerCase() === input.treasuryAddress.toLowerCase()) {
    return;
  }

  const shares = await input.vaultContract.balanceOf(input.walletAddress);
  if (shares <= 0n) {
    return;
  }

  const treasuryKyc = await input.asset.kycApproved(input.treasuryAddress);
  if (!treasuryKyc) {
    const setTreasuryKycTx = await sendAutomationTx(
      () => input.asset.setKyc(input.treasuryAddress, true),
      input.wallet
    );
    await waitForAutomationTx(setTreasuryKycTx);
  }

  await ensureExternalContractAllowed(input.vaultContract, input.treasuryAddress, input.wallet);
  const transferTx = await sendAutomationTx(
    () => input.vaultContract.transfer(input.treasuryAddress, shares),
    input.wallet
  );
  await waitForAutomationTx(transferTx);
}

async function fundVaultWithDeployerBalance(input: {
  asset: Contract;
  vaultContract: Contract;
  walletAddress: string;
  vaultAddress: string;
  amount: bigint;
}): Promise<VaultFundingResult> {
  const wallet = input.asset.runner;

  try {
    const deployerKyc = await input.asset.kycApproved(input.walletAddress);
    if (!deployerKyc) {
      const setKycTx = await sendAutomationTx(() => input.asset.setKyc(input.walletAddress, true), wallet);
      await waitForAutomationTx(setKycTx);
    }

    const vaultKyc = await input.asset.kycApproved(input.vaultAddress);
    if (!vaultKyc) {
      const setVaultKycTx = await sendAutomationTx(() => input.asset.setKyc(input.vaultAddress, true), wallet);
      await waitForAutomationTx(setVaultKycTx);
    }

    const approveTx = await sendAutomationTx(() => input.asset.approve(input.vaultAddress, input.amount), wallet);
    await waitForAutomationTx(approveTx);

    await ensureExternalContractAllowed(input.asset, input.vaultAddress, wallet);

    const depositTx = await sendAutomationTx(
      () => input.vaultContract.deposit(input.amount, input.walletAddress),
      wallet
    );
    const depositReceipt = await waitForAutomationTx(depositTx);

    let totalAssets = 0n;
    let shares = 0n;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      totalAssets = await input.vaultContract.totalAssets();
      shares = await input.vaultContract.balanceOf(input.walletAddress);
      if (shares > 0n) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (shares > 0n) {
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
      error: `Vault deposit completed but share balance did not verify (totalAssets=${totalAssets}, shares=${shares}).`
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
  const chainId = resolveProjectDeployChainId(input.chainId);

  if (!isRwaOperatorConfigured()) {
    return {
      status: 'SKIPPED',
      reason: 'Configurá PRIVY_OPERATOR_WALLET_ID + RWA_OPERATOR_ADDRESS o TOKEN_DEPLOY_PRIVATE_KEY con gas en Base.'
    };
  }

  if (!Number.isInteger(input.totalSupplyUnits) || input.totalSupplyUnits <= 0) {
    return { status: 'SKIPPED', reason: 'Supply de tokens inválido para la emisión.' };
  }

  let deploymentStep = 'bootstrap';
  try {
    const provider = new JsonRpcProvider(resolveChainRpcUrl(chainId));
    const wallet = await resolveRwaOperatorSigner(provider, chainId);
    if (!wallet) {
      provider.destroy();
      return { status: 'SKIPPED', reason: 'No se pudo resolver el operador RWA.' };
    }
    const walletAddress = await wallet.getAddress();
    await ensureAutomationSignerReady(wallet);
    const gasBalance = await provider.getBalance(walletAddress);
    if (gasBalance <= 0n) {
      provider.destroy();
      return { status: 'SKIPPED', reason: `La wallet operador ${walletAddress} no tiene gas en chain ${chainId}.` };
    }

    const tokenName = buildOnChainTokenName(input.tokenName, input.tokenInstrumentType);
    const symbol = normalizeSymbol(input.tokenSymbol);
    const treasuryAddress = resolveTreasuryAddress(input.treasuryAddress ?? walletAddress) ?? walletAddress;
    const mintRecipient = isVaultTokenStandard(input.tokenStandard) ? walletAddress : treasuryAddress;
    const mintAmount = BigInt(input.totalSupplyUnits) * 10n ** 18n;

    const assetFactory = new ContractFactory(
      SanovaAssetTokenArtifact.abi,
      SanovaAssetTokenArtifact.bytecode,
      wallet
    );

    deploymentStep = 'asset_deploy';
    const assetToken = await assetFactory.deploy(tokenName, symbol, walletAddress);
    await assetToken.waitForDeployment();
    const contractAddress = await assetToken.getAddress();
    const asset = new Contract(contractAddress, SanovaAssetTokenArtifact.abi, wallet);

    if (mintRecipient.toLowerCase() !== walletAddress.toLowerCase()) {
      const setKycTx = await sendAutomationTx(() => asset.setKyc(mintRecipient, true), wallet);
      await waitForAutomationTx(setKycTx);
    }

    deploymentStep = 'asset_mint';
    await ensureAutomationSignerReady(wallet);
    const mintTx = await sendAutomationTx(() => asset.mint(mintRecipient, mintAmount), wallet);
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
          deployerAddress: walletAddress,
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

    const vaultArtifact = SanovaRwaVaultArtifact;
    const vaultContractName = 'SanovaRwaVault';
    const vaultFactory = new ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);

    deploymentStep = 'vault_deploy';
    const vault = await vaultFactory.deploy(contractAddress, vaultName, vaultSymbol, walletAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    const vaultContract = new Contract(vaultAddress, vaultArtifact.abi, wallet);
    deploymentStep = 'vault_fund';
    const funding = await fundVaultWithDeployerBalance({
      asset,
      vaultContract,
      walletAddress,
      vaultAddress,
      amount: mintAmount
    });

    if (funding.status !== 'FUNDED') {
      provider.destroy();
      return {
        status: 'SKIPPED',
        reason: `Vault funding failed: ${funding.error ?? 'unknown error'}`
      };
    }

    let security: { allowedContracts: string[] } = { allowedContracts: [] };
    let securityConfigError: string | null = null;
    deploymentStep = 'security_config';
    try {
      security = await configureInitialContractSecurity({
        asset,
        vaultContract,
        treasuryAddress,
        totalAssets: mintAmount,
        extraAllowedContracts: [vaultAddress]
      });
    } catch (error) {
      securityConfigError =
        error instanceof Error ? error.message : 'No se pudo aplicar la política de seguridad inicial.';
    }

    deploymentStep = 'treasury_share_transfer';
    try {
      await transferVaultSharesToTreasury({
        asset,
        vaultContract,
        walletAddress,
        treasuryAddress,
        wallet
      });
    } catch (error) {
      provider.destroy();
      const message =
        error instanceof Error ? error.message : 'No se pudieron transferir shares al treasury Safe.';
      return { status: 'SKIPPED', reason: `Treasury share transfer failed: ${message}` };
    }

    const treasuryReady = await assertTreasuryVaultSharesReady({
      vaultAddress,
      contractAddress,
      chainId
    });
    if (treasuryReady.ok === false) {
      provider.destroy();
      return { status: 'SKIPPED', reason: treasuryReady.reason };
    }

    const treasuryShareTransferError: string | null = securityConfigError;

    deploymentStep = 'ownership_transfer';
    const ownershipTransfers = [
      await transferOwnershipToTreasury({
        contractName: 'SanovaAssetToken',
        contract: asset,
        contractAddress,
        deployerAddress: walletAddress,
        treasuryAddress
      }),
      await transferOwnershipToTreasury({
        contractName: vaultContractName,
        contract: vaultContract,
        contractAddress: vaultAddress,
        deployerAddress: walletAddress,
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
      vaultFundingError: treasuryShareTransferError ?? funding.error,
      chainId,
      txHash: funding.txHash ?? mintReceipt?.hash ?? 'deploy-submitted',
      ownershipTransfers,
      security
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown deployment error';
    return { status: 'SKIPPED', reason: `Sanova contracts [${deploymentStep}]: ${message}` };
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
