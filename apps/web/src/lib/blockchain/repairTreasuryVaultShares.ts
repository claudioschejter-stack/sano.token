import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import { ensureAutomationSignerReady, sendAutomationTx, waitForAutomationTx } from './automationTx';
import { resolveTreasuryAddress } from './treasuryPolicy';
import { resolveChainId } from './explorerUrls';
import { isRwaOperatorConfigured, resolveRwaOperatorSigner } from './rwaOperatorSigner';

function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453 || chainId === 84532) {
    return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org';
}

export async function repairTreasuryVaultShares(asset: AdminAssetRecord): Promise<{
  ok: boolean;
  message: string;
  txHash?: string;
}> {
  const treasuryAddress = resolveTreasuryAddress();
  const vaultAddress = asset.vaultAddress?.trim();
  const contractAddress = asset.contractAddress?.trim();

  if (!isRwaOperatorConfigured() || !treasuryAddress || !vaultAddress || !contractAddress) {
    return { ok: false, message: 'Faltan credenciales de operador, treasury o contratos desplegados.' };
  }

  const chainId = asset.chainId ?? resolveChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  const wallet = await resolveRwaOperatorSigner(provider, chainId);

  if (!wallet) {
    provider.destroy();
    return { ok: false, message: 'No se pudo resolver el operador RWA.' };
  }

  const walletAddress = await wallet.getAddress();

  try {
    await ensureAutomationSignerReady(wallet);
    const assetContract = new Contract(contractAddress, SanovaAssetTokenArtifact.abi, wallet);
    const vaultContract = new Contract(vaultAddress, SanovaRwaVaultArtifact.abi, wallet);

    const deployerShares = await vaultContract.balanceOf(walletAddress);
    if (deployerShares <= 0n) {
      const treasuryShares = await vaultContract.balanceOf(treasuryAddress);
      if (treasuryShares > 0n) {
        return { ok: true, message: 'Treasury Safe ya tiene shares del vault.' };
      }
      return { ok: false, message: 'La wallet operador no tiene shares para transferir al treasury.' };
    }

    const treasuryKyc = await assetContract.kycApproved(treasuryAddress);
    if (!treasuryKyc) {
      const setKycTx = await sendAutomationTx(() => assetContract.setKyc(treasuryAddress, true), wallet);
      await waitForAutomationTx(setKycTx);
    }

    const allowed = await vaultContract.externalContractAllowed(treasuryAddress);
    if (!allowed) {
      const allowTx = await sendAutomationTx(
        () => vaultContract.setExternalContractAllowed(treasuryAddress, true),
        wallet
      );
      await waitForAutomationTx(allowTx);
      for (let attempt = 0; attempt < 8 && !(await vaultContract.externalContractAllowed(treasuryAddress)); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const transferTx = await sendAutomationTx(
      () => vaultContract.transfer(treasuryAddress, deployerShares),
      wallet
    );
    const receipt = await waitForAutomationTx(transferTx);

    let treasuryShares = 0n;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      treasuryShares = await vaultContract.balanceOf(treasuryAddress);
      if (treasuryShares > 0n) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (treasuryShares <= 0n) {
      const deployerAfter = await vaultContract.balanceOf(walletAddress);
      if (deployerAfter <= 0n) {
        return {
          ok: true,
          message: 'Shares salieron del operador; el treasury puede tardar en reflejarse en el RPC.',
          txHash: receipt.hash
        };
      }
      return { ok: false, message: 'Transferencia enviada pero el treasury aún no muestra shares.' };
    }

    return {
      ok: true,
      message: `Shares transferidas al treasury Safe (${treasuryShares.toString()}).`,
      txHash: receipt.hash
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudieron transferir shares al treasury.'
    };
  } finally {
    provider.destroy();
  }
}
