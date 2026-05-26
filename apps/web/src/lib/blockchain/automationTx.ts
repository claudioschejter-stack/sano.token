import type { ContractTransactionResponse, TransactionReceipt, TransactionResponse } from 'ethers';

export function automationConfirmations(): number {
  const parsed = Number.parseInt(process.env.AUTOMATION_TX_CONFIRMATIONS ?? '1', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function waitForAutomationTx(tx: ContractTransactionResponse | TransactionResponse): Promise<TransactionReceipt> {
  const receipt = await tx.wait(automationConfirmations());
  if (!receipt) {
    throw new Error(`Transaction ${tx.hash} did not return a receipt.`);
  }
  return receipt;
}
