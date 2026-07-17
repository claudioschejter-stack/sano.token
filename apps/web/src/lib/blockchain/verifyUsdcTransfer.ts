import { ethers } from 'ethers';
import { getStablecoinNetwork } from '../payments/stablecoinNetworks';

const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from,address indexed to,uint256 value)'];
const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

// Flat shape (not a discriminated union) on purpose: this codebase's local
// TypeScript toolchain has been observed to mis-narrow `{ok:true}|{ok:false}`
// unions on boolean discriminants inside if/else (confirmed with an isolated
// repro), so callers should branch on `.ok` and read `confirmations`/`reason`
// directly instead of relying on narrowing.
export type UsdcTransferVerification = {
  ok: boolean;
  confirmations?: number;
  reason?: string;
};

/**
 * Best-effort, non-blocking check that a pasted txHash actually moved the
 * expected USDC amount to the expected destination on Base. Used by admin
 * withdrawal fulfillment as a safety net against typos/wrong tx — never
 * blocks confirmation on its own, since RPC availability isn't guaranteed.
 */
export async function verifyUsdcTransferOnBase(input: {
  txHash: string;
  expectedTo: string;
  expectedAmountUsd: number;
  expectedFrom?: string | null;
  stablecoinNetwork?: string | null;
}): Promise<UsdcTransferVerification> {
  const network = getStablecoinNetwork(input.stablecoinNetwork ?? 'BASE');
  if (!network.rpcUrl || !network.tokenAddress) {
    return { ok: false, reason: 'RPC_OR_TOKEN_NOT_CONFIGURED' };
  }
  if (!ethers.isHexString(input.txHash, 32)) {
    return { ok: false, reason: 'INVALID_TX_HASH_FORMAT' };
  }

  try {
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const receipt = await provider.getTransactionReceipt(input.txHash);
    if (!receipt) {
      return { ok: false, reason: 'TX_NOT_FOUND' };
    }
    if (receipt.status !== 1) {
      return { ok: false, reason: 'TX_REVERTED' };
    }

    const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
    const expectedTo = ethers.getAddress(input.expectedTo);
    const expectedFrom = input.expectedFrom ? ethers.getAddress(input.expectedFrom).toLowerCase() : null;
    const expectedAmount = ethers.parseUnits(input.expectedAmountUsd.toFixed(network.decimals), network.decimals);

    const match = receipt.logs
      .filter((log) => log.address.toLowerCase() === network.tokenAddress?.toLowerCase())
      .some((log) => {
        if (log.topics[0] !== USDC_TRANSFER_TOPIC) return false;
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) return false;
        const to = ethers.getAddress(parsed.args.to as string);
        const from = ethers.getAddress(parsed.args.from as string).toLowerCase();
        const value = parsed.args.value as bigint;
        return to === expectedTo && value === expectedAmount && (!expectedFrom || from === expectedFrom);
      });

    if (!match) {
      return { ok: false, reason: 'TRANSFER_NOT_FOUND_IN_TX' };
    }

    const latestBlock = await provider.getBlockNumber();
    return { ok: true, confirmations: latestBlock - receipt.blockNumber + 1 };
  } catch (error) {
    console.error('[verifyUsdcTransferOnBase]', error);
    return { ok: false, reason: 'RPC_ERROR' };
  }
}
