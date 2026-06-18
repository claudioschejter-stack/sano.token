import type { Connector } from 'wagmi';
import {
  ANDROID_COINBASE_WC_CONNECTOR_ID,
  ANDROID_METAMASK_WC_CONNECTOR_ID,
  MOBILE_DIRECT_WALLET_CONNECT_ID
} from './walletConnectRegistry';

export type CheckoutWalletOptionId = 'electronic_wallet' | 'metamask_usdc' | 'binance_usdc';

export function pickCoinbaseConnector(connectors: readonly Connector[]) {
  return connectors.find(
    (connector) =>
      connector.id === 'coinbaseWalletSDK' ||
      connector.type === 'coinbaseWallet' ||
      connector.name.toLowerCase().includes('coinbase')
  );
}

/** Generic WalletConnect modal (all wallets) — used by walletconnect_usdc checkout option. */
export function pickWalletConnectConnector(connectors: readonly Connector[]) {
  return connectors.find((connector) => connector.id === 'walletConnect');
}

/** WC instance with showQrModal disabled — iOS deep link to a single wallet app. */
export function pickDirectWalletConnectConnector(connectors: readonly Connector[]) {
  return connectors.find((connector) => connector.id === MOBILE_DIRECT_WALLET_CONNECT_ID);
}

export function pickAndroidCoinbaseWalletConnectConnector(connectors: readonly Connector[]) {
  return connectors.find((connector) => connector.id === ANDROID_COINBASE_WC_CONNECTOR_ID);
}

export function pickAndroidMetaMaskWalletConnectConnector(connectors: readonly Connector[]) {
  return connectors.find((connector) => connector.id === ANDROID_METAMASK_WC_CONNECTOR_ID);
}

export function pickMetaMaskConnector(connectors: readonly Connector[]) {
  return connectors.find(
    (connector) =>
      connector.id === 'metaMaskSDK' ||
      connector.id === 'io.metamask' ||
      connector.name.toLowerCase().includes('metamask')
  );
}

export function pickBinanceConnector(connectors: readonly Connector[]) {
  return connectors.find(
    (connector) =>
      connector.id === 'wallet.binance.com' ||
      connector.type === 'binanceWallet' ||
      connector.id === 'binanceWeb3' ||
      connector.id === 'BinanceW3WSDK' ||
      connector.id === 'binance' ||
      connector.name.toLowerCase().includes('binance')
  );
}
