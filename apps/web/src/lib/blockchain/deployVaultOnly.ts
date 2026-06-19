import { Contract, ContractFactory, JsonRpcProvider } from 'ethers';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import { resolveChainId } from './explorerUrls';
import type { VaultFundingStatus } from '../admin/launchTypes';
import { sendAutomationTx, waitForAutomationTx } from './automationTx';
import { assertTreasuryVaultSharesReady } from './verifyTreasuryVaultShares';
import { resolveTreasuryAddress } from './treasuryPolicy';
import { transferOwnershipToTreasury, type OwnershipTransferResult } from './ownershipTransfer';
import { configureInitialContractSecurity } from './securityPolicy';
import { isRwaOperatorConfigured, resolveRwaOperatorSigner } from './rwaOperatorSigner';

export type DeployVaultOnlyInput = {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  totalSupplyUnits: number;
  treasuryAddress?: string;
};

export type DeployVaultOnlyResult =
  | {
      status: 'DEPLOYED';
      vaultAddress: string;
      chainId: number;
      txHash: string;
      vaultFundingStatus: VaultFundingStatus;
      vaultFundingAmount: string | null;
      vaultFundingTxHash: string | null;
      vaultFundingError: string | null;
      ownershipTransfers?: OwnershipTransferResult[];
      security?: { allowedContracts: string[] };
    }
  | { status: 'SKIPPED'; reason: string };

function resolveRpcUrl(chainId: number): string {
  if (chainId === 84532 || chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || (chainId === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org');
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
}

function normalizeSymbol(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.slice(0, 8) || 'RWA';
}

/** Deploy SanovaRwaVault for an already-minted SanovaAssetToken (ERC-4626 completion). */
export async function deployVaultForExistingToken(
  input: DeployVaultOnlyInput
): Promise<DeployVaultOnlyResult> {
  const chainId = resolveChainId();

  if (!isRwaOperatorConfigured()) {
    return { status: 'SKIPPED', reason: 'Operador RWA no configurado.' };
  }

  const contractAddress = input.contractAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return { status: 'SKIPPED', reason: 'Dirección de token inválida.' };
  }

  try {
    const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
    const wallet = await resolveRwaOperatorSigner(provider, chainId);
    if (!wallet) {
      return { status: 'SKIPPED', reason: 'No se pudo resolver el operador RWA.' };
    }
    const walletAddress = await wallet.getAddress();
    const treasuryAddress = resolveTreasuryAddress(input.treasuryAddress ?? walletAddress) ?? walletAddress;
    const gasBalance = await provider.getBalance(walletAddress);
    if (gasBalance <= 0n) {
      provider.destroy();
      return { status: 'SKIPPED', reason: `La wallet operador ${walletAddress} no tiene gas en chain ${chainId}.` };
    }

    const tokenName = input.tokenName.trim().slice(0, 64);
    const symbol = normalizeSymbol(input.tokenSymbol);
    const vaultName = `${tokenName} Vault`.slice(0, 64);
    const vaultSymbol = `v${symbol}`.slice(0, 8);

    const asset = new Contract(contractAddress, SanovaAssetTokenArtifact.abi, wallet);

    const vaultFactory = new ContractFactory(
      SanovaRwaVaultArtifact.abi,
      SanovaRwaVaultArtifact.bytecode,
      wallet
    );

    const vault = await vaultFactory.deploy(contractAddress, vaultName, vaultSymbol, walletAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    const vaultContract = new Contract(vaultAddress, SanovaRwaVaultArtifact.abi, wallet);

    let vaultFundingStatus: VaultFundingStatus = 'NO_TOKENS';
    let vaultFundingAmount: string | null = null;
    let vaultFundingTxHash: string | null = null;
    let vaultFundingError: string | null = null;

    try {
      const deployerKyc = await asset.kycApproved(walletAddress);
      if (!deployerKyc) {
        const setKycTx = await asset.setKyc(walletAddress, true);
        await waitForAutomationTx(setKycTx);
      }
      if (treasuryAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        const treasuryKyc = await asset.kycApproved(treasuryAddress);
        if (!treasuryKyc) {
          const setTreasuryKycTx = await asset.setKyc(treasuryAddress, true);
          await waitForAutomationTx(setTreasuryKycTx);
        }
      }

      const vaultKyc = await asset.kycApproved(vaultAddress);
      if (!vaultKyc) {
        const setVaultKycTx = await asset.setKyc(vaultAddress, true);
        await waitForAutomationTx(setVaultKycTx);
      }

      let deployerBalance = await asset.balanceOf(walletAddress);
      if (deployerBalance === 0n) {
        const currentSupply = await asset.totalSupply();
        if (currentSupply === 0n) {
          const mintAmount = BigInt(input.totalSupplyUnits) * 10n ** 18n;
          const mintTx = await asset.mint(walletAddress, mintAmount);
          await waitForAutomationTx(mintTx);
          deployerBalance = await asset.balanceOf(walletAddress);
        }
      }

      if (deployerBalance > 0n) {
        const depositAmount = deployerBalance;
        const vaultAllowed = await asset.externalContractAllowed(vaultAddress);
        if (!vaultAllowed) {
          const allowVaultTx = await asset.setExternalContractAllowed(vaultAddress, true);
          await waitForAutomationTx(allowVaultTx);
        }
        const approveTx = await asset.approve(vaultAddress, depositAmount);
        await waitForAutomationTx(approveTx);
        const depositTx = await vaultContract.deposit(depositAmount, walletAddress);
        const depositReceipt = await waitForAutomationTx(depositTx);
        const totalAssets = await vaultContract.totalAssets();
        const shares = await vaultContract.balanceOf(walletAddress);

        vaultFundingTxHash = depositReceipt?.hash ?? depositTx.hash;
        if (totalAssets >= depositAmount && shares > 0n) {
          vaultFundingStatus = 'FUNDED';
          vaultFundingAmount = depositAmount.toString();
        } else {
          vaultFundingStatus = 'FAILED';
          vaultFundingError = 'Vault deposit completed but totalAssets/share balance did not verify.';
        }
      } else {
        vaultFundingError = 'La wallet deployer no tiene tokens para depositar en el vault.';
      }
    } catch (depositError) {
      console.warn('[deployVaultOnly] deposit skipped:', depositError);
      vaultFundingStatus = 'FAILED';
      vaultFundingError = depositError instanceof Error ? depositError.message : 'Vault deposit failed';
    }

    const security = await configureInitialContractSecurity({
      asset,
      vaultContract,
      treasuryAddress,
      totalAssets: vaultFundingAmount ? BigInt(vaultFundingAmount) : BigInt(input.totalSupplyUnits) * 10n ** 18n,
      extraAllowedContracts: [vaultAddress]
    });

    if (vaultFundingStatus === 'FUNDED' && treasuryAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      const deployerShares = await vaultContract.balanceOf(walletAddress);
      if (deployerShares > 0n) {
        const treasuryKyc = await asset.kycApproved(treasuryAddress);
        if (!treasuryKyc) {
          const setTreasuryKycTx = await sendAutomationTx(() => asset.setKyc(treasuryAddress, true), wallet);
          await waitForAutomationTx(setTreasuryKycTx);
        }
        const receiverAllowed = await vaultContract.externalContractAllowed(treasuryAddress);
        if (!receiverAllowed) {
          const allowReceiverTx = await sendAutomationTx(
            () => vaultContract.setExternalContractAllowed(treasuryAddress, true),
            wallet
          );
          await waitForAutomationTx(allowReceiverTx);
        }
        for (let attempt = 0; attempt < 8 && !(await vaultContract.externalContractAllowed(treasuryAddress)); attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        const transferTx = await sendAutomationTx(
          () => vaultContract.transfer(treasuryAddress, deployerShares),
          wallet
        );
        await waitForAutomationTx(transferTx);
      }
    }

    const ownershipTransfers = [
      await transferOwnershipToTreasury({
        contractName: 'SanovaAssetToken',
        contract: asset,
        contractAddress,
        deployerAddress: walletAddress,
        treasuryAddress
      }),
      await transferOwnershipToTreasury({
        contractName: 'SanovaRwaVault',
        contract: vaultContract,
        contractAddress: vaultAddress,
        deployerAddress: walletAddress,
        treasuryAddress
      })
    ];

    if (vaultFundingStatus === 'FUNDED') {
      const treasuryReady = await assertTreasuryVaultSharesReady({
        vaultAddress,
        contractAddress,
        chainId
      });
      if (treasuryReady.ok === false) {
        provider.destroy();
        return {
          status: 'SKIPPED',
          reason: treasuryReady.reason
        };
      }
    }

    provider.destroy();

    return {
      status: 'DEPLOYED',
      vaultAddress,
      chainId,
      txHash: vaultFundingTxHash || 'vault-deployed',
      vaultFundingStatus,
      vaultFundingAmount,
      vaultFundingTxHash,
      vaultFundingError,
      ownershipTransfers,
      security
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vault deployment failed';
    return { status: 'SKIPPED', reason: message };
  }
}
