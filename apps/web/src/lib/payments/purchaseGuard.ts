import { prisma, type Prisma } from '@sanova/database';
import { Contract, JsonRpcProvider } from 'ethers';
import SanovaAssetTokenArtifact from '../blockchain/artifacts/SanovaAssetToken.json';
import { resolveBaseMainnetRpcUrl } from '../blockchain/baseRpc';
import { readWithRetry } from '../blockchain/rpcRetry';
import { isPendingInvestorWallet } from '../investor/provisionInvestorProfile';

type ProjectTokenFields = {
  vaultAddress: string | null;
  contractAddress: string | null;
  chainId: number | null;
};

/**
 * Base mainnet se resuelve por `baseRpc`, que prefiere el endpoint dedicado sobre
 * el público. Este módulo tenía su propia resolución leyendo solo `BASE_RPC_URL`
 * con `https://mainnet.base.org` de fallback, así que cargar una key de Alchemy no
 * cambiaba nada acá: la comprobación de allowlist de cada compra seguía yendo al
 * endpoint compartido, que devuelve "missing revert data" cuando lo throttlean.
 */
function resolveRpcUrl(chainId: number): string {
  if (chainId === 8453) {
    return resolveBaseMainnetRpcUrl();
  }
  return process.env.BASE_RPC_URL?.trim() || 'https://sepolia.base.org';
}

export function projectRequiresTokenAllowlist(project: ProjectTokenFields): boolean {
  return Boolean(project.vaultAddress?.trim() || project.contractAddress?.trim());
}

export async function assertTokenizedPurchaseReady(input: {
  project: ProjectTokenFields;
  projectId: string;
  walletAddress: string | null | undefined;
  tx?: Prisma.TransactionClient;
}) {
  if (!projectRequiresTokenAllowlist(input.project)) {
    return;
  }

  const wallet = input.walletAddress?.trim().toLowerCase();
  if (!wallet || isPendingInvestorWallet(wallet)) {
    throw new Error('WALLET_REQUIRED_FOR_TOKENIZED_PURCHASE');
  }

  const db = input.tx ?? prisma;
  const allowlist = await db.investorAllowlist.findFirst({
    where: {
      projectId: input.projectId,
      walletAddress: wallet,
      approved: true
    }
  });

  if (!allowlist) {
    throw new Error('ALLOWLIST_NOT_APPROVED');
  }

  const tokenAddress = input.project.contractAddress?.trim();
  const chainId = input.project.chainId;
  if (!tokenAddress || !chainId) {
    return;
  }

  const provider = new JsonRpcProvider(resolveRpcUrl(chainId));
  try {
    const token = new Contract(tokenAddress, SanovaAssetTokenArtifact.abi, provider);
    /**
     * Con reintentos y distinguiendo "no aprobada" de "no pude leer". Antes una
     * sola lectura throttleada tiraba el error crudo del RPC y la compra moría
     * con un mensaje que no le dice nada al inversor ni al operador, aunque su
     * wallet estuviera perfectamente aprobada.
     */
    const approvedOnChain = await readWithRetry(() => token.kycApproved(wallet), { attempts: 4 });
    if (approvedOnChain === null) {
      throw new Error('ONCHAIN_ALLOWLIST_UNREADABLE');
    }
    if (!approvedOnChain) {
      throw new Error('ONCHAIN_ALLOWLIST_NOT_APPROVED');
    }
  } finally {
    provider.destroy();
  }
}

export function assertPaymentProofPresent(
  intent: {
    method: string;
    txHash: string | null;
    providerPaymentId: string | null;
  },
  input: {
    txHash?: string | null;
    providerPaymentId?: string | null;
  }
) {
  if (intent.method === 'INTERNAL_BALANCE') {
    return;
  }

  const txHash = input.txHash?.trim() || intent.txHash?.trim();
  const providerPaymentId = input.providerPaymentId?.trim() || intent.providerPaymentId?.trim();

  if (intent.method === 'USDC_ONCHAIN') {
    if (!txHash) {
      throw new Error('PAYMENT_TX_REQUIRED');
    }
    return;
  }

  if (!txHash && !providerPaymentId) {
    throw new Error('PAYMENT_CONFIRMATION_REQUIRED');
  }
}
