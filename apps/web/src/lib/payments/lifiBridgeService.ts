import { getStablecoinNetwork } from './stablecoinNetworks';

export type LifiBridgeQuote = {
  fromChain: string;
  toChain: 'BASE';
  fromToken: string;
  toToken: string;
  estimatedFeeUsd: number;
  tool: string;
  configured: boolean;
};

const LIFI_API = 'https://li.quest/v1';

function lifiConfigured(): boolean {
  return Boolean(process.env.LIFI_API_KEY?.trim());
}

/** Cotiza bridge USDC → Base treasury vía LI.FI (el comprador cubre fees en el total fiat). */
export async function quoteLifiUsdcToBase(input: {
  fromNetworkId: string;
  amountUsd: number;
}): Promise<LifiBridgeQuote> {
  const from = getStablecoinNetwork(input.fromNetworkId);
  const base = getStablecoinNetwork('BASE');

  if (from.id === 'BASE') {
    return {
      fromChain: from.id,
      toChain: 'BASE',
      fromToken: from.tokenAddress ?? 'USDC',
      toToken: base.tokenAddress ?? 'USDC',
      estimatedFeeUsd: 0,
      tool: 'none',
      configured: Boolean(base.treasuryAddress)
    };
  }

  if (!lifiConfigured() || !from.tokenAddress || !base.tokenAddress || !base.treasuryAddress) {
    return {
      fromChain: from.id,
      toChain: 'BASE',
      fromToken: from.tokenAddress ?? 'USDC',
      toToken: base.tokenAddress ?? 'USDC',
      estimatedFeeUsd: 0.5,
      tool: 'manual',
      configured: false
    };
  }

  try {
    const fromChainId = from.chainId ?? 8453;
    const toChainId = base.chainId ?? 8453;
    const amount = BigInt(Math.round(input.amountUsd * 10 ** (from.decimals ?? 6))).toString();

    const url = new URL(`${LIFI_API}/quote`);
    url.searchParams.set('fromChain', String(fromChainId));
    url.searchParams.set('toChain', String(toChainId));
    url.searchParams.set('fromToken', from.tokenAddress);
    url.searchParams.set('toToken', base.tokenAddress);
    url.searchParams.set('fromAmount', amount);
    url.searchParams.set('toAddress', base.treasuryAddress);

    const response = await fetch(url.toString(), {
      headers: {
        'x-lifi-api-key': process.env.LIFI_API_KEY!.trim()
      }
    });

    if (!response.ok) {
      throw new Error(`LIFI_${response.status}`);
    }

    const data = (await response.json()) as {
      estimate?: { feeCosts?: Array<{ amountUSD?: string }> };
      toolDetails?: { key?: string };
    };

    const feeUsd = (data.estimate?.feeCosts ?? []).reduce(
      (sum, row) => sum + Number(row.amountUSD ?? 0),
      0
    );

    return {
      fromChain: from.id,
      toChain: 'BASE',
      fromToken: from.tokenAddress,
      toToken: base.tokenAddress,
      estimatedFeeUsd: feeUsd > 0 ? feeUsd : 0.15,
      tool: data.toolDetails?.key ?? 'lifi',
      configured: true
    };
  } catch {
    return {
      fromChain: from.id,
      toChain: 'BASE',
      fromToken: from.tokenAddress ?? 'USDC',
      toToken: base.tokenAddress ?? 'USDC',
      estimatedFeeUsd: 0.35,
      tool: 'lifi_fallback',
      configured: false
    };
  }
}
