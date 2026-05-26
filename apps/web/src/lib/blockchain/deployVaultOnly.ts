import { Contract, ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import { resolveChainId } from './explorerUrls';
import type { VaultFundingStatus } from '../admin/launchTypes';

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
    }
  | { status: 'SKIPPED'; reason: string };

function resolvePrivateKey(): string | null {
  const key = (process.env.TOKEN_DEPLOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.trim();
  return key || null;
}

function resolveTreasuryAddress(fallback: string, explicit?: string): string {
  return explicit?.trim() || process.env.TOKEN_TREASURY_ADDRESS?.trim() || process.env.SANOVA_TREASURY_ADDRESS?.trim() || fallback;
}

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
  const privateKey = resolvePrivateKey();
  const chainId = resolveChainId();

  if (!privateKey) {
    return { status: 'SKIPPED', reason: 'TOKEN_DEPLOY_PRIVATE_KEY requerida.' };
  }

  const contractAddress = input.contractAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return { status: 'SKIPPED', reason: 'Dirección de token inválida.' };
  }

  try {
    const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
    const wallet = new Wallet(privateKey, provider);
    const treasuryAddress = resolveTreasuryAddress(wallet.address, input.treasuryAddress);
    const gasBalance = await provider.getBalance(wallet.address);
    if (gasBalance <= 0n) {
      provider.destroy();
      return { status: 'SKIPPED', reason: `La wallet de deploy ${wallet.address} no tiene gas en chain ${chainId}.` };
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

    const vault = await vaultFactory.deploy(contractAddress, vaultName, vaultSymbol, wallet.address);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    const vaultContract = new Contract(vaultAddress, SanovaRwaVaultArtifact.abi, wallet);

    let vaultFundingStatus: VaultFundingStatus = 'NO_TOKENS';
    let vaultFundingAmount: string | null = null;
    let vaultFundingTxHash: string | null = null;
    let vaultFundingError: string | null = null;

    try {
      const deployerKyc = await asset.kycApproved(wallet.address);
      if (!deployerKyc) {
        const setKycTx = await asset.setKyc(wallet.address, true);
        await setKycTx.wait();
      }
      if (treasuryAddress.toLowerCase() !== wallet.address.toLowerCase()) {
        const treasuryKyc = await asset.kycApproved(treasuryAddress);
        if (!treasuryKyc) {
          const setTreasuryKycTx = await asset.setKyc(treasuryAddress, true);
          await setTreasuryKycTx.wait();
        }
      }

      let deployerBalance = await asset.balanceOf(wallet.address);
      if (deployerBalance === 0n) {
        const currentSupply = await asset.totalSupply();
        if (currentSupply === 0n) {
          const mintAmount = BigInt(input.totalSupplyUnits) * 10n ** 18n;
          const mintTx = await asset.mint(wallet.address, mintAmount);
          await mintTx.wait();
          deployerBalance = await asset.balanceOf(wallet.address);
        }
      }

      if (deployerBalance > 0n) {
        const depositAmount = deployerBalance;
        const approveTx = await asset.approve(vaultAddress, depositAmount);
        await approveTx.wait();
        const depositTx = await vaultContract.deposit(depositAmount, treasuryAddress);
        const depositReceipt = await depositTx.wait();
        const totalAssets = await vaultContract.totalAssets();
        const shares = await vaultContract.balanceOf(treasuryAddress);

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

    provider.destroy();

    return {
      status: 'DEPLOYED',
      vaultAddress,
      chainId,
      txHash: vaultFundingTxHash || 'vault-deployed',
      vaultFundingStatus,
      vaultFundingAmount,
      vaultFundingTxHash,
      vaultFundingError
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vault deployment failed';
    return { status: 'SKIPPED', reason: message };
  }
}
