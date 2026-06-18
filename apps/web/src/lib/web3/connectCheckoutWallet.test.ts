import { describe, expect, it } from 'vitest';
import type { Connector } from 'wagmi';
import {
  hasBinanceWeb3Provider,
  resolveCheckoutWalletConnector,
  shouldPreferWalletConnectForCheckout
} from './connectCheckoutWallet';

function mockConnector(id: string, name = id): Connector {
  return { id, name, type: 'mock' } as Connector;
}

const connectors = [
  mockConnector('coinbaseWalletSDK', 'Coinbase Wallet'),
  mockConnector('metaMaskSDK', 'MetaMask'),
  mockConnector('binanceWeb3', 'Binance Web3 Wallet'),
  mockConnector('walletConnect', 'WalletConnect')
];

describe('resolveCheckoutWalletConnector', () => {
  it('picks coinbase for electronic_wallet', () => {
    const connector = resolveCheckoutWalletConnector('electronic_wallet', connectors, false);
    expect(connector?.id).toBe('coinbaseWalletSDK');
  });

  it('picks metamask for metamask_usdc', () => {
    const connector = resolveCheckoutWalletConnector('metamask_usdc', connectors, false);
    expect(connector?.id).toBe('metaMaskSDK');
  });

  it('falls back to walletconnect for binance without provider', () => {
    const connector = resolveCheckoutWalletConnector('binance_usdc', connectors, true);
    expect(connector?.id).toBe('walletConnect');
  });
});

describe('shouldPreferWalletConnectForCheckout', () => {
  it('prefers walletconnect for binance on desktop without injected provider', () => {
    expect(shouldPreferWalletConnectForCheckout('binance_usdc')).toBe(!hasBinanceWeb3Provider());
  });
});
