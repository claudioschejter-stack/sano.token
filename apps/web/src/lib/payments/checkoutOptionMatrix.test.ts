import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutOptionKind } from './checkoutOptionMatrix';

let privyEnabled = true;
let privyOnRamp = true;
let bridgeKey: string | null = 'bridge-key';
let macroConfigured = true;
let ripioReady = true;

vi.mock('../privy/config', () => ({ isPrivyEnabled: () => privyEnabled }));
vi.mock('./privyOnRampPolicy', () => ({ isPrivyOnRampConfigured: () => privyOnRamp }));
vi.mock('./bridgeClient', () => ({ getBridgeApiKey: () => bridgeKey }));
vi.mock('./macroClick/config', () => ({ isMacroClickConfigured: () => macroConfigured }));
vi.mock('./ripioClient', () => ({ ripioConfigured: () => ripioReady }));

const { checkoutCoverageForCountry, checkoutCoverageMatrix } = await import('./checkoutOptionMatrix');

const optionOf = (country: string, kind: CheckoutOptionKind) =>
  checkoutCoverageForCountry(country).options.find((row) => row.kind === kind)!;

beforeEach(() => {
  privyEnabled = true;
  privyOnRamp = true;
  bridgeKey = 'bridge-key';
  macroConfigured = true;
  ripioReady = true;
});

/**
 * Four things an investor recognises, not four providers. Behind each one the
 * provider changes by country, which is exactly what they should never have to
 * think about — and keeping the four fixed is what makes the gaps legible.
 */
describe('checkoutCoverageForCountry', () => {
  it('always offers the same four, in the same order', () => {
    for (const country of ['AR', 'BR', 'MX', 'US']) {
      expect(checkoutCoverageForCountry(country).options.map((row) => row.kind)).toEqual([
        'crypto_wallet',
        'virtual_wallet',
        'debit_card',
        'bank_transfer'
      ]);
    }
  });

  it('offers crypto and card everywhere, because neither depends on the country', () => {
    for (const country of ['AR', 'BR', 'MX', 'CO', 'US', 'GB', 'JP']) {
      expect(optionOf(country, 'crypto_wallet').available, country).toBe(true);
      expect(optionOf(country, 'debit_card').available, country).toBe(true);
    }
  });

  it('gives Brazil a wallet option paid by scanning', () => {
    const wallet = optionOf('BR', 'virtual_wallet');
    expect(wallet.available).toBe(true);
    expect(wallet.presentation).toBe('qr');
  });

  it('gives Mexico a wallet option, because a CLABE is paid from either app', () => {
    const wallet = optionOf('MX', 'virtual_wallet');
    expect(wallet.available).toBe(true);
    expect(wallet.presentation).toBe('account_details');
  });

  /**
   * The country with the highest wallet adoption in the region is the one with
   * no wallet button: Macro is a bank form, not something Ualá or Lemon can pay.
   */
  it('names Argentina missing wallet rail instead of pretending Macro is one', () => {
    const wallet = optionOf('AR', 'virtual_wallet');

    expect(wallet.available).toBe(false);
    expect(wallet.missing).toContain('QR interoperable');
    expect(optionOf('AR', 'bank_transfer').available).toBe(true);
  });

  it('says what is missing rather than hiding an option nobody configured', () => {
    bridgeKey = null;
    const mexico = optionOf('MX', 'bank_transfer');

    expect(mexico.available).toBe(false);
    expect(mexico.missing).toContain('bridge');
  });

  it('turns off everything in a sanctioned country, with the reason', () => {
    const coverage = checkoutCoverageForCountry('RU');

    expect(coverage.options.every((row) => !row.available)).toBe(true);
    expect(coverage.options.every((row) => row.missing?.includes('sancionado'))).toBe(true);
  });

  it('still offers crypto and card where no local rail exists', () => {
    const japan = checkoutCoverageForCountry('JP');

    expect(optionOf('JP', 'crypto_wallet').available).toBe(true);
    expect(optionOf('JP', 'debit_card').available).toBe(true);
    expect(japan.options.filter((row) => row.available)).toHaveLength(2);
  });
});

describe('checkoutCoverageMatrix', () => {
  it('reports every country with its four options', () => {
    const matrix = checkoutCoverageMatrix(['AR', 'MX']);

    expect(matrix).toHaveLength(2);
    expect(matrix.every((row) => row.options.length === 4)).toBe(true);
  });
});
