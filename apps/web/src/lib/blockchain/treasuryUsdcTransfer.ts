import {
  Contract,
  Interface,
  JsonRpcProvider,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits
} from 'ethers';
import { resolveTreasuryOwnerSigner } from './treasuryOwnerSigner';
import { resolveChainId } from './explorerUrls';
import { execAsOwner } from './safeExec';
import { usdcDecimals, usdcTokenAddress } from '../payments/paymentConfig';

/**
 * Move USDC out of the treasury Safe.
 *
 * Both owners of the governance Safe are server or hardware wallets, so there
 * is no browser path to this: refunds and test funding can only leave the Safe
 * through the server. Capped per call because it sends value to an address the
 * caller names.
 */

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

const MAX_TRANSFER_USDC = 250;

export type TreasuryUsdcTransferResult =
  | {
      ok: true;
      from: string;
      to: string;
      amountUsdc: string;
      remainingUsdc: string;
      txHash: string;
    }
  | { ok: false; code: string; detail?: string };

export function treasuryUsdcSafeAddress(): string | null {
  const raw =
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS?.trim() ||
    process.env.STABLECOIN_TREASURY_ADDRESS?.trim() ||
    process.env.TOKEN_TREASURY_ADDRESS?.trim() ||
    null;
  return raw && isAddress(raw) ? getAddress(raw) : null;
}

export async function readTreasuryUsdcBalance(
  provider: JsonRpcProvider
): Promise<{ safe: string | null; usdc: string | null }> {
  const safe = treasuryUsdcSafeAddress();
  const usdc = usdcTokenAddress();
  if (!safe || !usdc) {
    return { safe, usdc: null };
  }
  try {
    const contract = new Contract(usdc, ERC20_ABI, provider);
    const raw = (await contract.balanceOf(safe)) as bigint;
    return { safe, usdc: formatUnits(raw, usdcDecimals()) };
  } catch {
    return { safe, usdc: null };
  }
}

export async function transferTreasuryUsdc(input: {
  provider: JsonRpcProvider;
  to: string;
  amountUsdc: number;
}): Promise<TreasuryUsdcTransferResult> {
  if (!isAddress(input.to)) {
    return { ok: false, code: 'INVALID_RECIPIENT', detail: input.to };
  }
  if (!Number.isFinite(input.amountUsdc) || input.amountUsdc <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT', detail: String(input.amountUsdc) };
  }
  if (input.amountUsdc > MAX_TRANSFER_USDC) {
    return {
      ok: false,
      code: 'AMOUNT_ABOVE_CAP',
      detail: `máximo ${MAX_TRANSFER_USDC} USDC por llamada`
    };
  }

  const safe = treasuryUsdcSafeAddress();
  const usdc = usdcTokenAddress();
  if (!safe) {
    return { ok: false, code: 'TREASURY_NOT_CONFIGURED' };
  }
  if (!usdc) {
    return { ok: false, code: 'USDC_NOT_CONFIGURED' };
  }

  const decimals = usdcDecimals();
  const value = parseUnits(input.amountUsdc.toFixed(decimals), decimals);
  const token = new Contract(usdc, ERC20_ABI, input.provider);
  const balance = (await token.balanceOf(safe)) as bigint;

  if (balance < value) {
    return {
      ok: false,
      code: 'INSUFFICIENT_TREASURY_USDC',
      detail: `el treasury tiene ${formatUnits(balance, decimals)} USDC`
    };
  }

  const signer = await resolveTreasuryOwnerSigner(input.provider, resolveChainId());
  if (!signer) {
    return { ok: false, code: 'TREASURY_SIGNER_MISSING' };
  }

  const to = getAddress(input.to);
  const data = new Interface(ERC20_ABI).encodeFunctionData('transfer', [to, value]);
  const txHash = await execAsOwner({ owner: safe, signer, target: usdc, data });

  return {
    ok: true,
    from: safe,
    to,
    amountUsdc: formatUnits(value, decimals),
    remainingUsdc: formatUnits(balance - value, decimals),
    txHash
  };
}
