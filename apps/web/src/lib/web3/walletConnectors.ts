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

export function pickMetaMaskConnector(connectors: readonly Connector[]) {
  return connectors.find(
    (connector) =>
      connector.id === 'metaMaskSDK' ||
      connector.id === 'io.metamask' ||
      connector.id === 'injected' ||
      connector.name.toLowerCase().includes('metamask')
  );
}

export function pickBinanceConnector(connectors: readonly Connector[]) {
  return connectors.find(
    (connector) =>
      connector.id === 'binanceWeb3' ||
      connector.id === 'BinanceW3WSDK' ||
      connector.id === 'binance' ||
      connector.name.toLowerCase().includes('binance')
  );
}
