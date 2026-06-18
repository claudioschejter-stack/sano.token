import { encodeFunctionData, maxUint256, parseUnits } from 'viem';
import { ethers } from 'ethers';
import type { PreparedOnChainTx } from './executePreparedTransactions';
import { getStablecoinNetwork } from '../payments/stablecoinNetworks';

const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  }
] as const;

const ERC4626_DEPOSIT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  }
] as const;

const ERC20_TRANSFER_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ]
  }
] as const;

export const USDC_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

export type VaultDepositLine = {
  vaultAddress: string;
  amountUsd: number;
};

export type PreparedVaultDepositPayment = {
  chainId: number;
  stablecoinNetwork: string;
  usdcTokenAddress: string;
  receiver: string;
  transactions: PreparedOnChainTx[];
  deposits: Array<{ vaultAddress: string; amountBaseUnits: string }>;
};

function buildApproveTx(tokenAddress: string, spender: string): PreparedOnChainTx {
  return {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [spender as `0x${string}`, maxUint256]
    }),
    value: '0'
  };
}

function buildDepositTx(vaultAddress: string, assets: bigint, receiver: string): PreparedOnChainTx {
  return {
    to: vaultAddress,
    data: encodeFunctionData({
      abi: ERC4626_DEPOSIT_ABI,
      functionName: 'deposit',
      args: [assets, receiver as `0x${string}`]
    }),
    value: '0'
  };
}

/** Prepare approve + ERC-4626 deposit txs for investor wallet (USDC → vault shares). */
export function prepareVaultDepositPayment(input: {
  stablecoinNetwork: string;
  payerAddress: string;
  deposits: VaultDepositLine[];
}): PreparedVaultDepositPayment {
  const network = getStablecoinNetwork(input.stablecoinNetwork);
  if (network.kind !== 'EVM' || !network.chainId || !network.tokenAddress) {
    throw new Error('NETWORK_NOT_SUPPORTED');
  }

  const receiver = input.payerAddress.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(receiver)) {
    throw new Error('INVALID_PAYER_ADDRESS');
  }

  const lines = input.deposits.filter((row) => row.vaultAddress?.trim() && row.amountUsd > 0);
  if (!lines.length) {
    throw new Error('VAULT_DEPOSIT_LINES_REQUIRED');
  }

  const transactions: PreparedOnChainTx[] = [];
  const preparedDeposits: PreparedVaultDepositPayment['deposits'] = [];
  const approvedVaults = new Set<string>();

  for (const line of lines) {
    const vault = line.vaultAddress.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(vault)) {
      throw new Error('INVALID_VAULT_ADDRESS');
    }

    const assets = parseUnits(line.amountUsd.toFixed(network.decimals), network.decimals);
    if (assets <= 0n) {
      continue;
    }

    if (!approvedVaults.has(vault.toLowerCase())) {
      transactions.push(buildApproveTx(network.tokenAddress, vault));
      approvedVaults.add(vault.toLowerCase());
    }

    transactions.push(buildDepositTx(vault, assets, receiver));
    preparedDeposits.push({
      vaultAddress: ethers.getAddress(vault),
      amountBaseUnits: assets.toString()
    });
  }

  if (!transactions.length) {
    throw new Error('VAULT_DEPOSIT_LINES_REQUIRED');
  }

  return {
    chainId: network.chainId,
    stablecoinNetwork: network.id,
    usdcTokenAddress: network.tokenAddress,
    receiver: ethers.getAddress(receiver),
    transactions,
    deposits: preparedDeposits
  };
}

export type ExpectedVaultDeposit = {
  vaultAddress: string;
  amountBaseUnits: bigint;
  payerAddress: string;
};

/** Verify receipt contains USDC transfers from payer into each vault (direct ERC-4626 deposit). */
export function verifyVaultDepositReceipt(input: {
  receipt: ethers.TransactionReceipt;
  usdcTokenAddress: string;
  expectedDeposits: ExpectedVaultDeposit[];
}): boolean {
  const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
  const token = input.usdcTokenAddress.toLowerCase();

  const remaining = input.expectedDeposits.map((row) => ({
    vault: ethers.getAddress(row.vaultAddress),
    payer: ethers.getAddress(row.payerAddress).toLowerCase(),
    amount: row.amountBaseUnits,
    matched: false
  }));

  for (const log of input.receipt.logs) {
    if (log.address.toLowerCase() !== token || log.topics[0] !== USDC_TRANSFER_TOPIC) {
      continue;
    }

    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
    if (!parsed) {
      continue;
    }

    const from = ethers.getAddress(parsed.args.from as string).toLowerCase();
    const to = ethers.getAddress(parsed.args.to as string);
    const value = parsed.args.value as bigint;

    for (const expected of remaining) {
      if (expected.matched) {
        continue;
      }
      if (from === expected.payer && to === expected.vault && value >= expected.amount) {
        expected.matched = true;
        break;
      }
    }
  }

  return remaining.every((row) => row.matched);
}

export function isErc4626DirectDepositBatch(intents: Array<{ metadata: unknown }>): boolean {
  if (!intents.length) {
    return false;
  }
  return intents.every((row) => {
    const metadata = (row.metadata as Record<string, unknown>) ?? {};
    return metadata.purchaseMode === 'ERC4626_DEPOSIT' && typeof metadata.vaultAddress === 'string';
  });
}
