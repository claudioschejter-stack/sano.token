import { encodeFunctionData, parseUnits } from 'viem';
import type { PreparedOnChainTx } from './executePreparedTransactions';
import { getStablecoinNetwork } from '../payments/stablecoinNetworks';

const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  }
] as const;

const LIFI_API = 'https://li.quest/v1';

export type PreparedUsdcTreasuryPayment = {
  chainId: number;
  stablecoinNetwork: string;
  settlementNetwork: 'BASE';
  mode: 'direct' | 'bridge';
  transactions: PreparedOnChainTx[];
  bridgeTool?: string;
};

export function buildEvmUsdcTransferTx(input: {
  tokenAddress: string;
  treasuryAddress: string;
  amountUsd: number;
  decimals: number;
}): PreparedOnChainTx {
  const amount = parseUnits(input.amountUsd.toFixed(input.decimals), input.decimals);
  return {
    to: input.tokenAddress,
    data: encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [input.treasuryAddress as `0x${string}`, amount]
    }),
    value: '0'
  };
}

export async function prepareUsdcTreasuryPayment(input: {
  amountUsd: number;
  stablecoinNetwork: string;
  payerAddress: string;
}): Promise<PreparedUsdcTreasuryPayment> {
  const source = getStablecoinNetwork(input.stablecoinNetwork);
  const base = getStablecoinNetwork('BASE');

  if (source.kind !== 'EVM' || !source.chainId || !source.tokenAddress || !source.treasuryAddress) {
    throw new Error('NETWORK_NOT_SUPPORTED');
  }

  if (!base.tokenAddress || !base.treasuryAddress || !base.chainId) {
    throw new Error('TREASURY_NOT_CONFIGURED');
  }

  if (source.id === 'BASE') {
    return {
      chainId: source.chainId,
      stablecoinNetwork: source.id,
      settlementNetwork: 'BASE',
      mode: 'direct',
      transactions: [
        buildEvmUsdcTransferTx({
          tokenAddress: source.tokenAddress,
          treasuryAddress: base.treasuryAddress,
          amountUsd: input.amountUsd,
          decimals: source.decimals
        })
      ]
    };
  }

  const apiKey = process.env.LIFI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('BRIDGE_NOT_CONFIGURED');
  }

  const fromAmount = BigInt(Math.round(input.amountUsd * 10 ** source.decimals)).toString();
  const url = new URL(`${LIFI_API}/quote`);
  url.searchParams.set('fromChain', String(source.chainId));
  url.searchParams.set('toChain', String(base.chainId));
  url.searchParams.set('fromToken', source.tokenAddress);
  url.searchParams.set('toToken', base.tokenAddress);
  url.searchParams.set('fromAmount', fromAmount);
  url.searchParams.set('fromAddress', input.payerAddress);
  url.searchParams.set('toAddress', base.treasuryAddress);

  const response = await fetch(url.toString(), {
    headers: { 'x-lifi-api-key': apiKey }
  });

  if (!response.ok) {
    throw new Error('BRIDGE_QUOTE_FAILED');
  }

  const quote = (await response.json()) as {
    transactionRequest?: {
      to?: string;
      data?: string;
      value?: string;
      chainId?: number;
    };
    toolDetails?: { key?: string };
  };

  const tx = quote.transactionRequest;
  if (!tx?.to || !tx.data) {
    throw new Error('BRIDGE_TX_UNAVAILABLE');
  }

  return {
    chainId: tx.chainId ?? source.chainId,
    stablecoinNetwork: source.id,
    settlementNetwork: 'BASE',
    mode: 'bridge',
    bridgeTool: quote.toolDetails?.key ?? 'lifi',
    transactions: [
      {
        to: tx.to,
        data: tx.data,
        value: tx.value ?? '0'
      }
    ]
  };
}

export function isEvmAutoUsdcNetwork(networkId: string): boolean {
  const network = getStablecoinNetwork(networkId);
  return network.kind === 'EVM' && Boolean(network.chainId && network.tokenAddress && network.treasuryAddress);
}
