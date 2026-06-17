import { enabledStablecoinNetworks, getStablecoinNetwork } from './stablecoinNetworks';

export type CrossChainBridgeQuote = {
  fromNetwork: string;
  toNetwork: 'BASE';
  estimatedFeeUsd: number;
  bridgeProvider: 'lifi' | 'manual';
  configured: boolean;
  note: string;
};

/** Non-Base USDC se bridgea a Base treasury; el comprador cubre el fee en el quote. */
export function quoteCrossChainUsdcBridge(fromNetworkId?: string | null): CrossChainBridgeQuote {
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
      ? 'USDC se convierte automáticamente a Base vía LI.FI.'
      : 'Configurá LIFI_API_KEY para bridge automático a Base.'
  };
}
