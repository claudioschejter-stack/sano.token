import { prisma } from '@sanova/database';
import { Contract, JsonRpcProvider, Wallet, getAddress, isAddress } from 'ethers';
import { privyOperatorWalletId, resolveRwaOperatorAddressEnv } from '../privy/config';
import { privyApiBase, privyHeaders } from '../privy/privyHttp';

const OWNABLE_ABI = [
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)'
];

const BASE_MAINNET_RPC = 'https://mainnet.base.org';

export type OwnershipTransferStep = {
  contract: 'token' | 'vault';
  address: string;
  currentOwner: string | null;
  ok: boolean;
  txHash?: string;
  error?: string;
};

export type TransferOwnershipResult = {
  projectId: string;
  newOwner: string;
  signerAddress: string | null;
  steps: OwnershipTransferStep[];
};

/** Legacy deploy key that still owns the first RWA contracts. */
function resolveLegacyPrivateKey(): string | null {
  return (
    process.env.TOKEN_DEPLOY_PRIVATE_KEY?.trim() ||
    process.env.TREASURY_OWNER_PRIVATE_KEY?.trim() ||
    null
  );
}

async function privyWalletAddress(walletId: string): Promise<string | null> {
  if (!walletId) return null;
  try {
    const response = await fetch(`${privyApiBase()}/v1/wallets/${walletId}`, {
      headers: privyHeaders(),
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { address?: string };
    return payload.address?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Hand token/vault ownership to the Privy operator wallet.
 *
 * `setKyc` is `onlyOwner`, so while the owner is the legacy deploy EOA the server
 * cannot whitelist investors — purchases stay uncreditable. Signed with the legacy
 * key once; after this the app owns the lifecycle through Privy.
 */
export async function transferTokenOwnershipToOperator(input: {
  projectId: string;
  /** Defaults to the Privy operator wallet address. */
  newOwner?: string | null;
  includeVault?: boolean;
}): Promise<TransferOwnershipResult> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, contractAddress: true, vaultAddress: true }
  });
  if (!project) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  const target =
    input.newOwner?.trim() ||
    (await privyWalletAddress(privyOperatorWalletId())) ||
    resolveRwaOperatorAddressEnv();
  if (!target || !isAddress(target)) {
    throw new Error('NEW_OWNER_REQUIRED: configure PRIVY_OPERATOR_WALLET_ID or pass newOwner');
  }
  const newOwner = getAddress(target);

  const privateKey = resolveLegacyPrivateKey();
  if (!privateKey) {
    throw new Error(
      'LEGACY_OWNER_KEY_MISSING: set TOKEN_DEPLOY_PRIVATE_KEY (or TREASURY_OWNER_PRIVATE_KEY) to the key that owns the contracts'
    );
  }

  const provider = new JsonRpcProvider(process.env.BASE_RPC_URL?.trim() || BASE_MAINNET_RPC);
  const steps: OwnershipTransferStep[] = [];
  let signerAddress: string | null = null;

  try {
    const signer = new Wallet(privateKey, provider);
    signerAddress = await signer.getAddress();

    const targets: Array<{ kind: 'token' | 'vault'; address: string | null }> = [
      { kind: 'token', address: project.contractAddress },
      ...(input.includeVault === false
        ? []
        : [{ kind: 'vault' as const, address: project.vaultAddress }])
    ];

    for (const entry of targets) {
      if (!entry.address) continue;
      const contract = new Contract(entry.address, OWNABLE_ABI, signer);

      let currentOwner: string | null = null;
      try {
        currentOwner = getAddress((await contract.owner()) as string);
      } catch (error) {
        steps.push({
          contract: entry.kind,
          address: entry.address,
          currentOwner: null,
          ok: false,
          error: error instanceof Error ? error.message.slice(0, 200) : 'OWNER_READ_FAILED'
        });
        continue;
      }

      if (currentOwner.toLowerCase() === newOwner.toLowerCase()) {
        steps.push({
          contract: entry.kind,
          address: entry.address,
          currentOwner,
          ok: true,
          error: 'ALREADY_OWNED'
        });
        continue;
      }

      if (currentOwner.toLowerCase() !== signerAddress.toLowerCase()) {
        steps.push({
          contract: entry.kind,
          address: entry.address,
          currentOwner,
          ok: false,
          error: `SIGNER_IS_NOT_OWNER: owner is ${currentOwner}, signer is ${signerAddress}. A Safe owner needs the Safe flow.`
        });
        continue;
      }

      try {
        const tx = await contract.transferOwnership(newOwner);
        const receipt = await tx.wait();
        steps.push({
          contract: entry.kind,
          address: entry.address,
          currentOwner,
          ok: true,
          txHash: receipt?.hash ?? tx.hash
        });
      } catch (error) {
        steps.push({
          contract: entry.kind,
          address: entry.address,
          currentOwner,
          ok: false,
          error: error instanceof Error ? error.message.slice(0, 250) : 'TRANSFER_FAILED'
        });
      }
    }
  } finally {
    provider.destroy();
  }

  return { projectId: project.id, newOwner, signerAddress, steps };
}
