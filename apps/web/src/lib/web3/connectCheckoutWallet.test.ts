import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connector } from 'wagmi';
import {
  mobileWalletTargetForOption,
  resolveCheckoutWalletConnector,
  shouldPreferWalletConnectForCheckout
} from './connectCheckoutWallet';

vi.mock('../mobile/deviceConfig', () => ({
  isMobileDevice: vi.fn(() => false)
}));

const { isMobileDevice } = await import('../mobile/deviceConfig');

function mockConnector(id: string, name = id, type = 'mock'): Connector {
  return { id, name, type } as Connector;
}

const connectors = [
  mockConnector('coinbaseWalletSDK', 'Coinbase Wallet', 'coinbaseWallet'),
  mockConnector('metaMaskSDK', 'MetaMask', 'metaMask'),
  mockConnector('wallet.binance.com', 'Binance Wallet', 'binanceWallet'),
  mockConnector('walletConnectDirect', 'WalletConnect Direct', 'walletConnect'),
  mockConnector('walletConnect', 'WalletConnect Modal', 'walletConnect')
];

describe('resolveCheckoutWalletConnector', () => {
  beforeEach(() => {
    vi.mocked(isMobileDevice).mockReturnValue(false);
  });

  it('picks coinbase SDK on desktop for electronic_wallet', () => {
    const connector = resolveCheckoutWalletConnector('electronic_wallet', connectors);
    expect(connector?.id).toBe('coinbaseWalletSDK');
  });

  it('picks metamask SDK on desktop for metamask_usdc', () => {
    const connector = resolveCheckoutWalletConnector('metamask_usdc', connectors);
    expect(connector?.id).toBe('metaMaskSDK');
  });

  it('picks binance wallet connector directly', () => {
    const connector = resolveCheckoutWalletConnector('binance_usdc', connectors);
    expect(connector?.id).toBe('wallet.binance.com');
  });

  it('picks direct walletConnect on mobile for coinbase', () => {
    vi.mocked(isMobileDevice).mockReturnValue(true);
    const connector = resolveCheckoutWalletConnector('electronic_wallet', connectors);
    expect(connector?.id).toBe('walletConnectDirect');
  });

  it('picks direct walletConnect on mobile for metamask', () => {
    vi.mocked(isMobileDevice).mockReturnValue(true);
    const connector = resolveCheckoutWalletConnector('metamask_usdc', connectors);
    expect(connector?.id).toBe('walletConnectDirect');
  });
});

describe('mobileWalletTargetForOption', () => {
  beforeEach(() => {
    vi.mocked(isMobileDevice).mockReturnValue(false);
  });

  it('returns null on desktop', () => {
    expect(mobileWalletTargetForOption('electronic_wallet')).toBeNull();
    expect(mobileWalletTargetForOption('metamask_usdc')).toBeNull();
  });

  it('returns wallet targets on mobile', () => {
    vi.mocked(isMobileDevice).mockReturnValue(true);
    expect(mobileWalletTargetForOption('electronic_wallet')).toBe('coinbase');
    expect(mobileWalletTargetForOption('metamask_usdc')).toBe('metamask');
    expect(mobileWalletTargetForOption('binance_usdc')).toBeNull();
  });
});

describe('shouldPreferWalletConnectForCheckout', () => {
  it('never routes branded wallets through generic walletconnect flag', () => {
    expect(shouldPreferWalletConnectForCheckout('electronic_wallet')).toBe(false);
    expect(shouldPreferWalletConnectForCheckout('binance_usdc')).toBe(false);
    expect(shouldPreferWalletConnectForCheckout('metamask_usdc')).toBe(false);
  });
});
