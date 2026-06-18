import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openMobileWalletWcDeepLink } from './mobileWalletDeepLink';

describe('openMobileWalletWcDeepLink', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
  });

  it('opens coinbase native wc deep link without navigating away', () => {
    const click = vi.fn();
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    let href = '';
    const anchor = {
      get href() {
        return href;
      },
      set href(value: string) {
        href = value;
      },
      rel: '',
      style: { display: '' },
      click
    };

    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild, removeChild }
    });

    openMobileWalletWcDeepLink('coinbase', 'wc:abc@2?relay-protocol=irn');

    expect(href).toBe('cbwallet://wc?uri=wc%3Aabc%402%3Frelay-protocol%3Dirn');
    expect(click).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(removeChild).toHaveBeenCalledWith(anchor);
  });

  it('opens metamask native wc deep link', () => {
    const click = vi.fn();
    let href = '';
    const anchor = {
      get href() {
        return href;
      },
      set href(value: string) {
        href = value;
      },
      rel: '',
      style: { display: '' },
      click
    };

    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    });

    openMobileWalletWcDeepLink('metamask', 'wc:abc@2?relay-protocol=irn');

    expect(href).toBe('metamask://wc?uri=wc%3Aabc%402%3Frelay-protocol%3Dirn');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
