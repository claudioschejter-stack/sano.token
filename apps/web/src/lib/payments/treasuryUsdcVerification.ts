import { ethers } from 'ethers';
import { paymentMinimumConfirmations } from './paymentConfig';
import { getStablecoinNetwork } from './stablecoinNetworks';

const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

function normalizeAddress(value?: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    return ethers.getAddress(value.trim());
  } catch {
    return null;
  }
}

export async function verifyTreasuryUsdcReceipt(input: {
  txHash: string;
  expectedAmountUsd: number;
  expectedPayer?: string | null;
  networkId?: string | null;
}): Promise<{ ok: true; amountBaseUnits: string } | { ok: false; error: string }> {
  const network = getStablecoinNetwork(input.networkId ?? 'BASE');
  const rpcUrl = network.rpcUrl;
  const usdcAddress = network.tokenAddress;
  const treasuryAddress = network.treasuryAddress;

  if (!rpcUrl || !usdcAddress || !treasuryAddress) {
    return { ok: false, error: 'TREASURY_NOT_CONFIGURED' };
  }

  const tokenDecimals = network.decimals ?? 6;
  const expectedAmount = BigInt(Math.round(input.expectedAmountUsd * 10 ** tokenDecimals));

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  try {
    const receipt = await provider.getTransactionReceipt(input.txHash);
    if (!receipt || receipt.status !== 1) {
      return { ok: false, error: 'TX_NOT_CONFIRMED' };
    }

    const confirmations = (await provider.getBlockNumber()) - receipt.blockNumber + 1;
    if (confirmations < paymentMinimumConfirmations()) {
      return { ok: false, error: 'TX_CONFIRMATIONS_PENDING' };
    }

    const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
    const expectedTo = ethers.getAddress(treasuryAddress);
    const expectedFrom = normalizeAddress(input.expectedPayer);

    const matchingLog = receipt.logs
      .filter((log) => log.address.toLowerCase() === usdcAddress.toLowerCase())
      .find((log) => {
        if (log.topics[0] !== USDC_TRANSFER_TOPIC) return false;
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
        if (!parsed) return false;
        const to = ethers.getAddress(String(parsed.args.to));
        const from = ethers.getAddress(String(parsed.args.from));
        const value = BigInt(parsed.args.value);
        if (to !== expectedTo) return false;
        if (expectedFrom && from !== expectedFrom) return false;
        return value >= expectedAmount;
      });

    if (!matchingLog) {
      return { ok: false, error: 'USDC_TRANSFER_NOT_FOUND' };
    }

    const parsed = iface.parseLog({
      topics: [...matchingLog.topics],
      data: matchingLog.data
    });
    return { ok: true, amountBaseUnits: String(parsed?.args.value ?? expectedAmount) };
  } finally {
    provider.destroy();
  }
}
