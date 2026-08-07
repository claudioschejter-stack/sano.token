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
import { readKycTimelock } from './scheduleTokenKyc';
import { readWithRetry } from './rpcRetry';
import { confirmOnChain } from './confirmOnChain';

/**
 * The whitelist write only counts once a read shows it.
 *
 * Reading `kycApproved` straight after the receipt can hit a node that has not
 * applied the block yet and answer with the state from before. Calling that a
 * failure is the expensive mistake: the investor is approved on chain, but the
 * purchase is filed as broken and the share never gets delivered.
 */
async function confirmKycApproved(input: {
  token: Contract;
  input: { walletAddress: string; approved: boolean };
  via: string;
}): Promise<void> {
  const outcome = await confirmOnChain({
    read: () => input.token.kycApproved(input.input.walletAddress) as Promise<boolean>,
    satisfied: (value) => Boolean(value) === input.input.approved
  });

  if (!outcome.confirmed) {
    throw new Error(
      `ALLOWLIST_NOT_CONFIRMED: la transacción vía ${input.via} se confirmó pero kycApproved sigue leyendo ${String(
        outcome.value
      )}. Puede ser retraso del RPC: verificá antes de reintentar.`
    );
  }
}

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
     * Ask the token before spending anything, for two reasons.
     *
     * `setKyc` is not idempotent: the token deletes the scheduled action once it
     * runs, so approving somebody who is already approved reverts rather than
     * doing nothing. Re-linking a wallet used to broadcast one doomed
     * transaction per project.
     *
     * And inside a running timelock it reverts too. Both answers are free to
     * read, so the check belongs here, where every caller passes through, rather
     * than in each of them.
     */
    const current = await readWithRetry(
      () => token.kycApproved(input.walletAddress) as Promise<boolean>
    );
    if (current !== null && current === input.approved) {
      return {
        chainId,
        txHash: null as string | null,
        walletAddress: input.walletAddress,
        approved: input.approved,
        via: 'already_set' as const
      };
    }

    const timelock = await readKycTimelock({
      provider,
      tokenAddress: input.tokenAddress,
      investorAddress: input.walletAddress,
      approved: input.approved
    }).catch(() => null);

    if (timelock && !timelock.ready) {
      throw new Error(
        timelock.readyAt
          ? `KYC_TIMELOCK_PENDING: ejecutable a partir de ${new Date(timelock.readyAt * 1000).toISOString()}`
          : 'KYC_TIMELOCK_NOT_SCHEDULED: hay que agendar la acción antes de poder ejecutarla'
      );
    }

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
        await confirmKycApproved({ token, input, via: 'módulo' });
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
    await confirmKycApproved({ token, input, via: 'dueño del token' });
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
