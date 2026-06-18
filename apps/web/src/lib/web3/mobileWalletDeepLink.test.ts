import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openMobileWalletWcDeepLink } from './mobileWalletDeepLink';

describe('openMobileWalletWcDeepLink', () => {
  const open = vi.fn();

  beforeEach(() => {
    open.mockReset();
    vi.stubGlobal('window', { open });
  });

  it('opens coinbase native wc deep link in a new context', () => {
    openMobileWalletWcDeepLink('coinbase', 'wc:abc@2?relay-protocol=irn');

    expect(open).toHaveBeenCalledWith(
      'cbwallet://wc?uri=wc%3Aabc%402%3Frelay-protocol%3Dirn',
      '_blank',
      'noreferrer noopener'
    );
  });

  it('opens metamask native wc deep link in a new context', () => {
    openMobileWalletWcDeepLink('metamask', 'wc:abc@2?relay-protocol=irn');

    expect(open).toHaveBeenCalledWith(
      'metamask://wc?uri=wc%3Aabc%402%3Frelay-protocol%3Dirn',
      '_blank',
      'noreferrer noopener'
    );
  });
});
