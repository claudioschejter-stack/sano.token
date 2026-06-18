import { describe, expect, it, vi } from 'vitest';
import { openMobileWalletWcDeepLink } from './mobileWalletDeepLink';

describe('openMobileWalletWcDeepLink', () => {
  it('opens coinbase universal link with encoded wc uri', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });

    openMobileWalletWcDeepLink('coinbase', 'wc:abc@2?relay-protocol=irn');

    expect(assign).toHaveBeenCalledWith(
      'https://wallet.coinbase.com/wsegue?uri=wc%3Aabc%402%3Frelay-protocol%3Dirn'
    );
  });

  it('opens metamask deep link with encoded wc uri', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });

    openMobileWalletWcDeepLink('metamask', 'wc:abc@2?relay-protocol=irn');

    expect(assign).toHaveBeenCalledWith('metamask://wc?uri=wc%3Aabc%402%3Frelay-protocol%3Dirn');
  });
});
