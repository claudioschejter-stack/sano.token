import { describe, expect, it } from 'vitest';
import { resolveFiatRail } from './fiatRailPolicy';

/**
 * Macro wherever Macro can collect, Bridge wherever it cannot.
 *
 * The earlier version of this test re-declared the rule inside the test file, so
 * it kept passing while the checkout resolver drifted away from it. These cases
 * call the policy the resolver actually uses.
 */
describe('resolveFiatRail', () => {
  const configured = { macroConfigured: true, bridgeConfigured: true };

  it('cobra la tarjeta argentina por Macro', () => {
    expect(resolveFiatRail({ country: 'AR', kind: 'card', ...configured })).toEqual({
      provider: 'macro_click',
      configured: true,
      reason: null
    });
  });

  it('cobra la transferencia argentina por Macro, no por Bridge', () => {
    expect(resolveFiatRail({ country: 'AR', kind: 'transfer', ...configured })).toEqual({
      provider: 'macro_click',
      configured: true,
      reason: null
    });
  });

  it('sin credenciales de Macro, Argentina no ofrece la tarjeta', () => {
    const decision = resolveFiatRail({
      country: 'AR',
      kind: 'card',
      macroConfigured: false,
      bridgeConfigured: true
    });
    expect(decision.configured).toBe(false);
    expect(decision.reason).toBe('collector_not_configured');
  });

  it('usa Bridge para la transferencia donde Macro no cobra', () => {
    for (const country of ['US', 'DE', 'MX', 'BR', 'GB']) {
      expect(resolveFiatRail({ country, kind: 'transfer', ...configured })).toEqual({
        provider: 'bridge',
        configured: true,
        reason: null
      });
    }
  });

  it('en un país de Bridge sin credenciales no ofrece nada', () => {
    const decision = resolveFiatRail({
      country: 'DE',
      kind: 'transfer',
      macroConfigured: true,
      bridgeConfigured: false
    });
    expect(decision.configured).toBe(false);
    expect(decision.reason).toBe('collector_not_configured');
  });

  /** Bridge opens bank accounts; it cannot take a card number. */
  it('no ofrece tarjeta fuera de donde cobra Macro', () => {
    const decision = resolveFiatRail({ country: 'US', kind: 'card', ...configured });
    expect(decision.provider).toBeNull();
    expect(decision.reason).toBe('no_card_acquirer_for_country');
  });

  it('declara sin cobrador los países que ninguno alcanza', () => {
    const decision = resolveFiatRail({ country: 'JP', kind: 'transfer', ...configured });
    expect(decision.provider).toBeNull();
    expect(decision.reason).toBe('no_collector_for_country');
  });
});
