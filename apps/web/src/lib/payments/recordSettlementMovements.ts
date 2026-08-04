import { ethers } from 'ethers';
import { baseRpcUrls, getStablecoinNetwork } from './stablecoinNetworks';
import { recordTokenMovement } from '../reconciliation/tokenMovementLedger';

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

export type SettlementMovementsResult = {
  paymentUsdc: number;
  gasFeeUsdc: number;
  recorded: number;
};

/**
 * Persist every USDC leg of a settle tx: the treasury payment and the paymaster
 * gas fee. The 0.004xxx USDC that the paymaster charges was invisible to accounting.
 */
export async function recordSettlementMovements(input: {
  txHash: string;
  payerAddress: string;
  treasuryAddress: string;
  userId?: string | null;
  investorId?: string | null;
  projectId?: string | null;
  paymentIntentId?: string | null;
}): Promise<SettlementMovementsResult> {
  const network = getStablecoinNetwork('BASE');
  if (!network.tokenAddress) {
    return { paymentUsdc: 0, gasFeeUsdc: 0, recorded: 0 };
  }

  const token = network.tokenAddress.toLowerCase();
  const decimals = network.decimals ?? 6;
  const payer = input.payerAddress.trim().toLowerCase();
  const treasury = input.treasuryAddress.trim().toLowerCase();

  let lastError: unknown = null;
  for (const url of baseRpcUrls()) {
    const provider = new ethers.JsonRpcProvider(url, 8453, { staticNetwork: true });
    try {
      const receipt = await provider.getTransactionReceipt(input.txHash);
      const block = receipt ? await provider.getBlock(receipt.blockNumber) : null;
      provider.destroy();
      if (!receipt) {
        return { paymentUsdc: 0, gasFeeUsdc: 0, recorded: 0 };
      }

      const occurredAt = block?.timestamp ? new Date(block.timestamp * 1000) : null;
      let paymentUsdc = 0;
      let gasFeeUsdc = 0;
      let recorded = 0;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== token) continue;
        if (log.topics[0] !== TRANSFER_TOPIC) continue;

        const from = `0x${log.topics[1].slice(26)}`;
        const to = `0x${log.topics[2].slice(26)}`;
        if (from.toLowerCase() !== payer) continue;

        const raw = BigInt(log.data);
        const amount = Number(ethers.formatUnits(raw, decimals));
        // Payer → treasury is the investment; any other payer outflow in the same
        // tx is the ERC-20 paymaster taking its gas fee.
        const isPayment = to.toLowerCase() === treasury;

        await recordTokenMovement({
          kind: isPayment ? 'USDC_PAYMENT' : 'USDC_GAS_FEE',
          asset: 'USDC',
          contractAddress: network.tokenAddress,
          fromAddress: from,
          toAddress: to,
          amountRaw: raw.toString(),
          decimals,
          txHash: input.txHash,
          logIndex: log.index,
          blockNumber: receipt.blockNumber,
          occurredAt,
          projectId: input.projectId ?? null,
          userId: input.userId ?? null,
          investorId: input.investorId ?? null,
          paymentIntentId: input.paymentIntentId ?? null,
          metadata: { source: 'settle', role: isPayment ? 'treasury_payment' : 'paymaster_gas' }
        });

        if (isPayment) paymentUsdc += amount;
        else gasFeeUsdc += amount;
        recorded += 1;
      }

      return {
        paymentUsdc: Number(paymentUsdc.toFixed(6)),
        gasFeeUsdc: Number(gasFeeUsdc.toFixed(6)),
        recorded
      };
    } catch (error) {
      provider.destroy();
      lastError = error;
    }
  }

  console.error('[recordSettlementMovements] failed', lastError);
  return { paymentUsdc: 0, gasFeeUsdc: 0, recorded: 0 };
}
