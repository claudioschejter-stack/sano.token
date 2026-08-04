import { Contract, JsonRpcProvider } from 'ethers';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import { resolveChainId } from './explorerUrls';
import { waitForAutomationTx } from './automationTx';
import {
  kycOperatorModuleAddress,
  moduleCanWhitelist,
  setKycViaModule
} from './kycOperatorModule';
import { isRwaOperatorConfigured, resolveRwaOperatorSigner } from './rwaOperatorSigner';

function resolveRpcUrl(chainId: number): string {
  if (chainId === 84532 || chainId === 8453) {
    return process.env.BASE_RPC_URL?.trim() || (chainId === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org');
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
}

export async function setInvestorKycAllowlist(input: {
  tokenAddress: string;
  walletAddress: string;
  approved: boolean;
}) {
  if (!isRwaOperatorConfigured()) {
    throw new Error('Operador RWA no configurado para modificar allowlist on-chain.');
  }

  const chainId = resolveChainId();
  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  try {
    const wallet = await resolveRwaOperatorSigner(provider, chainId);
    if (!wallet) {
      throw new Error('No se pudo resolver el operador RWA.');
    }

    const token = new Contract(input.tokenAddress, SanovaAssetTokenArtifact.abi, wallet);

    /**
     * Two-tier authority: when a Safe owns the token, whitelisting goes through
     * the KYC module so the Safe keeps mint/pause/ownership while the operator
     * can only approve investors.
     */
    const moduleAddress = kycOperatorModuleAddress();
    if (moduleAddress) {
      const operatorAddress = await wallet.getAddress();
      const usable = await moduleCanWhitelist({
        moduleAddress,
        tokenAddress: input.tokenAddress,
        operatorAddress,
        provider
      });

      if (usable) {
        const txHash = await setKycViaModule({
          moduleAddress,
          tokenAddress: input.tokenAddress,
          investorAddress: input.walletAddress,
          approved: input.approved,
          signer: wallet
        });
        const verified = await token.kycApproved(input.walletAddress);
        if (Boolean(verified) !== input.approved) {
          throw new Error('Module transaction confirmed but kycApproved did not match requested state.');
        }
        return {
          chainId,
          txHash,
          walletAddress: input.walletAddress,
          approved: input.approved,
          via: 'safe_module' as const
        };
      }
    }

    // Direct owner call (operator wallet must be the token owner).
    const tx = await token.setKyc(input.walletAddress, input.approved);
    const receipt = await waitForAutomationTx(tx);
    const verified = await token.kycApproved(input.walletAddress);
    if (Boolean(verified) !== input.approved) {
      throw new Error('Allowlist transaction confirmed but kycApproved did not match requested state.');
    }
    return {
      chainId,
      txHash: receipt?.hash ?? tx.hash,
      walletAddress: input.walletAddress,
      approved: input.approved,
      via: 'token_owner' as const
    };
  } finally {
    provider.destroy();
  }
}
