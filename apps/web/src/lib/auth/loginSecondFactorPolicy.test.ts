import { describe, expect, it } from 'vitest';
import { isMobileUserAgent } from './isMobileUserAgent';

/**
 * The rule the login depends on: the second factor is skipped on phones, so
 * claiming to be a phone cannot be enough on its own.
 */
function isMobileLogin(channel: string | null | undefined, userAgent: string): boolean {
  const claimsMobile = channel === 'pwa' || channel === 'mobile-web';
  return claimsMobile && isMobileUserAgent(userAgent);
}

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

describe('a quién se le saltea el segundo factor', () => {
  it('un teléfono real que se declara PWA lo saltea', () => {
    expect(isMobileLogin('pwa', IPHONE)).toBe(true);
    expect(isMobileLogin('mobile-web', IPHONE)).toBe(true);
  });

  it('un desktop que se declara PWA no lo saltea', () => {
    // The whole point: the channel comes from the request body, so anyone with
    // a password could have claimed to be a phone and skipped the factor.
    expect(isMobileLogin('pwa', MAC)).toBe(false);
    expect(isMobileLogin('mobile-web', MAC)).toBe(false);
  });

  it('un teléfono que se declara desktop no lo saltea', () => {
    expect(isMobileLogin('desktop-web', IPHONE)).toBe(false);
  });

  it('sin canal ni user-agent, pide el factor', () => {
    expect(isMobileLogin(null, '')).toBe(false);
    expect(isMobileLogin(undefined, MAC)).toBe(false);
  });
});
