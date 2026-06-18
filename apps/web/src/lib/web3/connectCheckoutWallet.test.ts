import { describe, expect, it } from 'vitest';
import type { Connector } from 'wagmi';
import {
  resolveCheckoutWalletConnector,
  shouldPreferWalletConnectForCheckout
} from './connectCheckoutWallet';

function mockConnector(id: string, name = id, type = 'mock'): Connector {
  return { id, name, type } as Connector;
}

const connectors = [
  mockConnector('coinbaseWalletSDK', 'Coinbase Wallet', 'coinbaseWallet'),
  mockConnector('metaMaskSDK', 'MetaMask', 'metaMask'),
  mockConnector('wallet.binance.com', 'Binance Wallet', 'binanceWallet'),
  mockConnector('walletConnect', 'WalletConnect', 'walletConnect')
];

describe('resolveCheckoutWalletConnector', () => {
  it('picks coinbase for electronic_wallet', () => {
    const connector = resolveCheckoutWalletConnector('electronic_wallet', connectors);
    expect(connector?.id).toBe('coinbaseWalletSDK');
  });

  it('picks metamask for metamask_usdc', () => {
    const connector = resolveCheckoutWalletConnector('metamask_usdc', connectors);
    expect(connector?.id).toBe('metaMaskSDK');
  });

  it('picks binance wallet connector directly', () => {
    const connector = resolveCheckoutWalletConnector('binance_usdc', connectors);
    expect(connector?.id).toBe('wallet.binance.com');
  });
});

describe('shouldPreferWalletConnectForCheckout', () => {
  it('never routes branded wallets through generic walletconnect', () => {
    expect(shouldPreferWalletConnectForCheckout('electronic_wallet')).toBe(false);
    expect(shouldPreferWalletConnectForCheckout('binance_usdc')).toBe(false);
    expect(shouldPreferWalletConnectForCheckout('metamask_usdc')).toBe(false);
  });
});
