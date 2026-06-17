import { enabledStablecoinNetworks, getStablecoinNetwork } from './stablecoinNetworks';

export type CrossChainBridgeQuote = {
  fromNetwork: string;
  toNetwork: 'BASE';
  estimatedFeeUsd: number;
  bridgeProvider: 'lifi' | 'manual';
  configured: boolean;
  note: string;
};

/** Estimación sync para quotes de checkout (fees incluidos en total fiat). */
export function estimateCrossChainUsdcBridgeFee(fromNetworkId?: string | null): CrossChainBridgeQuote {
  const from = getStablecoinNetwork(fromNetworkId);
  const base = getStablecoinNetwork('BASE');

  if (from.id === 'BASE') {
    return {
      fromNetwork: from.id,
      toNetwork: 'BASE',
      estimatedFeeUsd: 0,
      bridgeProvider: 'lifi',
      configured: Boolean(base.treasuryAddress),
      note: 'Ya estás en Base; no se requiere bridge.'
    };
  }

  const lifiConfigured = Boolean(process.env.LIFI_API_KEY?.trim());
  const rankFee = from.cheapestRank === 2 ? 0.08 : from.cheapestRank === 3 ? 0.02 : 0.45;

  return {
    fromNetwork: from.id,
    toNetwork: 'BASE',
    estimatedFeeUsd: rankFee,
    bridgeProvider: lifiConfigured ? 'lifi' : 'manual',
    configured: Boolean(base.treasuryAddress) && enabledStablecoinNetworks().some((n) => n.id === from.id),
    note: lifiConfigured
      ? 'USDC se convierte automáticamente a Base vía LI.FI al tesoro Morpho.'
      : 'Configurá LIFI_API_KEY para bridge automático a Base treasury.'
  };
}
