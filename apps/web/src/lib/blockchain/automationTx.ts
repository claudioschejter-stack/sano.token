import type {
  ContractRunner,
  ContractTransactionResponse,
  JsonRpcProvider,
  Signer,
  TransactionReceipt,
  TransactionResponse
} from 'ethers';

export function automationConfirmations(): number {
  const parsed = Number.parseInt(process.env.AUTOMATION_TX_CONFIRMATIONS ?? '1', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function isAlreadyKnownError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: string;
    message?: string;
    error?: { message?: string };
    shortMessage?: string;
  };
  const haystack = [candidate.message, candidate.shortMessage, candidate.error?.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  return candidate.code === 'UNKNOWN_ERROR' && haystack.includes('already known');
}

function asSigner(runner: ContractRunner | null | undefined): Signer | null {
  if (!runner || !('getAddress' in runner)) return null;
  return runner as Signer;
}

async function waitForPendingNonce(signer: Signer, timeoutMs = 120_000): Promise<void> {
  const provider = signer.provider as JsonRpcProvider | null;
  if (!provider) return;

  const address = await signer.getAddress();
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const [latest, pending] = await Promise.all([
      provider.getTransactionCount(address, 'latest'),
      provider.getTransactionCount(address, 'pending')
    ]);
    if (pending <= latest) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

export async function sendAutomationTx<T extends ContractTransactionResponse>(
  send: () => Promise<T>,
  wallet?: ContractRunner | null
): Promise<T> {
  try {
    return await send();
  } catch (error) {
    const signer = asSigner(wallet);
    if (isAlreadyKnownError(error) && signer) {
      await waitForPendingNonce(signer);
      return await send();
    }
    throw error;
  }
}

export async function waitForAutomationTx(tx: ContractTransactionResponse | TransactionResponse): Promise<TransactionReceipt> {
  const receipt = await tx.wait(automationConfirmations());
  if (!receipt) {
    throw new Error(`Transaction ${tx.hash} did not return a receipt.`);
  }
  if (receipt.status === 0) {
    throw new Error(`Transaction ${receipt.hash} reverted on-chain.`);
  }
  return receipt;
}
