import { describe, expect, it } from 'vitest';
import { FIAT_RAIL_TREASURY_PROVIDERS } from './fiatRailTreasurySettlement';

/**
 * A provider saying money moved is a claim. USDC on Base is the fact, and only
 * the fact should release tokens. Bridge used to confirm a purchase and deliver
 * shares the moment its webhook said "paid", with nothing checking the treasury
 * had actually received anything.
 */
describe('rails that must wait for treasury USDC', () => {
  it('includes Bridge, which used to confirm on its webhook alone', () => {
    expect(FIAT_RAIL_TREASURY_PROVIDERS.has('bridge')).toBe(true);
  });

  it('keeps the rails that already waited', () => {
    expect(FIAT_RAIL_TREASURY_PROVIDERS.has('ebanx')).toBe(true);
  });

  it('does not hold back the crypto rail, which is already on-chain', () => {
    // Investor USDC is verified as it is paid; routing it here would stall it.
    expect(FIAT_RAIL_TREASURY_PROVIDERS.has('usdc')).toBe(false);
    expect(FIAT_RAIL_TREASURY_PROVIDERS.has('privy')).toBe(false);
  });
});
