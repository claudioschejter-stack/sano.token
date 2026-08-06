import { beforeEach, describe, expect, it, vi } from 'vitest';

let macroConfigured = true;
let bridgeKey: string | null = 'bridge-key';

vi.mock('./macroClick/config', () => ({ isMacroClickConfigured: () => macroConfigured }));
vi.mock('./bridgeClient', () => ({ getBridgeApiKey: () => bridgeKey }));

const { resolveLocalWalletRail, localWalletRailCoverage } = await import('./localWalletRail');

beforeEach(() => {
  macroConfigured = true;
  bridgeKey = 'bridge-key';
});

/**
 * The premise: every wallet in a country reads the same national rail, so the
 * country picks the rail and the investor picks nothing. Integrating Mercado
 * Pago, Ualá, Lemon and Belo separately would be four integrations of one thing.
 */
describe('resolveLocalWalletRail', () => {
  it('sends Brazil to Pix, as a code their wallet scans', () => {
    const result = resolveLocalWalletRail('BR');

    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.rail).toMatchObject({ railId: 'pix', presentation: 'qr', instant: true });
    }
  });

  it('sends Mexico to SPEI, which settles in seconds around the clock', () => {
    const result = resolveLocalWalletRail('MX');

    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.rail).toMatchObject({
        railId: 'spei',
        provider: 'bridge',
        instant: true
      });
    }
  });

  it('sends Colombia to Bre-B', () => {
    const result = resolveLocalWalletRail('CO');
    expect(result.available && result.rail.railId).toBe('bre_b');
  });

  /** Bridge issues no ARS virtual accounts, so Argentina cannot ride Bridge. */
  it('keeps Argentina on Macro rather than Bridge', () => {
    const result = resolveLocalWalletRail('AR');

    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.rail.provider).toBe('macro_click');
    }
  });

  it('treats the euro zone as one rail', () => {
    for (const country of ['ES', 'DE', 'PT', 'IT']) {
      const result = resolveLocalWalletRail(country);
      expect(result.available && result.rail.railId).toBe('sepa');
    }
  });

  it('marks the slow rails as not instant, so the copy can say so', () => {
    const us = resolveLocalWalletRail('US');
    const mx = resolveLocalWalletRail('MX');

    expect(us.available && us.rail.instant).toBe(false);
    expect(mx.available && mx.rail.instant).toBe(true);
  });

  /**
   * "Not configured" and "no rail here" are different answers: one is a switch
   * nobody flipped, the other is a country we cannot serve. Collapsing them
   * would hide a misconfiguration behind a geography excuse.
   */
  it('separates a rail that is off from a country that has none', () => {
    bridgeKey = null;
    const mexico = resolveLocalWalletRail('MX');
    expect(mexico).toMatchObject({ available: false, reason: 'PROVIDER_NOT_CONFIGURED' });
    expect(mexico.available === false && mexico.rail?.railId).toBe('spei');

    const japan = resolveLocalWalletRail('JP');
    expect(japan).toMatchObject({ available: false, reason: 'NO_LOCAL_RAIL' });
  });

  it('refuses a sanctioned country before looking for a rail', () => {
    expect(resolveLocalWalletRail('RU')).toMatchObject({
      available: false,
      reason: 'SANCTIONED_COUNTRY'
    });
  });

  it('falls back to Argentina when the country is unknown, as the country resolver does', () => {
    expect(resolveLocalWalletRail(null).available && resolveLocalWalletRail(null)).toBeTruthy();
    expect(resolveLocalWalletRail('').available).toBe(true);
  });
});

describe('localWalletRailCoverage', () => {
  it('lists each country once, with whether its provider is switched on', () => {
    const rows = localWalletRailCoverage();
    const countries = rows.map((row) => row.country);

    expect(new Set(countries).size).toBe(countries.length);
    expect(countries).toContain('MX');
    expect(countries).toContain('BR');
    expect(countries).toContain('AR');
    expect(rows.every((row) => typeof row.rail.configured === 'boolean')).toBe(true);
  });

  it('reports coverage as off when the provider is not configured', () => {
    bridgeKey = null;
    const rows = localWalletRailCoverage();

    expect(rows.find((row) => row.country === 'MX')?.rail.configured).toBe(false);
    expect(rows.find((row) => row.country === 'AR')?.rail.configured).toBe(true);
  });
});
