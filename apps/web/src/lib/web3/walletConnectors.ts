import type { Connector } from 'wagmi';

export function pickCoinbaseConnector(connectors: readonly Connector[]) {
  return connectors.find(
    (connector) =>
      connector.id === 'coinbaseWalletSDK' ||
      connector.type === 'coinbaseWallet' ||
      connector.name.toLowerCase().includes('coinbase')
  );
}

export function pickWalletConnectConnector(connectors: readonly Connector[]) {
  return connectors.find(
    (connector) =>
      connector.id === 'walletConnect' ||
      connector.type === 'walletConnect' ||
      connector.name.toLowerCase().includes('walletconnect')
  );
}
