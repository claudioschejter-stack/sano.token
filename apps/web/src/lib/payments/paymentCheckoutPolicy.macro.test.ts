import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkoutRowAllowedForMode } from './paymentCheckoutPolicy';
import { getPaymentCheckoutRowById } from './depositPaymentOptions';
import { paymentGatewayConfigured } from './paymentConfig';

/**
 * Macro's backend was complete — hosted form, encryption, webhook, settlement —
 * and checkout still hid it, because the policy only let through rows from the
 * local-rail aggregator and Macro is a direct integration.
 */
describe('Macro in checkout', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
    vi.unstubAllEnvs();
  });

  function macroRow(id: string) {
    const row = getPaymentCheckoutRowById(id);
    expect(row).not.toBeNull();
    return row!;
  }

  function configureMacro() {
    process.env.MACRO_CLICK_GUID = 'guid';
    process.env.MACRO_CLICK_FRASE = 'frase';
    process.env.MACRO_CLICK_SECRET_KEY = 'secret';
  }

  function unconfigureMacro() {
    delete process.env.MACRO_CLICK_GUID;
    delete process.env.MACRO_CLICK_FRASE;
    delete process.env.MACRO_CLICK_SECRET_KEY;
    delete process.env.LOCAL_RAILS_ENABLED;
    delete process.env.EBANX_API_KEY;
  }

  it('offers Macro for a purchase once it is configured', () => {
    configureMacro();
    for (const id of ['macro_click_ars', 'macro_click_usd', 'macro_click_debin']) {
      expect(checkoutRowAllowedForMode(macroRow(id), 'purchase')).toBe(true);
    }
  });

  it('does not offer Macro when it is not configured', () => {
    unconfigureMacro();
    expect(checkoutRowAllowedForMode(macroRow('macro_click_ars'), 'purchase')).toBe(false);
  });

  it('does not depend on the aggregator flag, which is what hid it', () => {
    unconfigureMacro();
    configureMacro();
    // No LOCAL_RAILS_ENABLED, no EBANX key: Macro still shows.
    expect(checkoutRowAllowedForMode(macroRow('macro_click_debin'), 'purchase')).toBe(true);
  });

  /**
   * The row was visible but the checkout still refused it: `LOCAL_RAIL` counted
   * as configured only when the aggregator flag or an EBANX key was set, so a
   * Macro cart threw `PAYMENT_METHOD_NOT_CONFIGURED` at the last step.
   */
  it('counts the local rail as configured on Macro credentials alone', () => {
    unconfigureMacro();
    expect(paymentGatewayConfigured('LOCAL_RAIL')).toBe(false);

    configureMacro();
    expect(paymentGatewayConfigured('LOCAL_RAIL')).toBe(true);
  });

  it('names the payment method, never the bank behind it', () => {
    for (const id of ['macro_click_ars', 'macro_click_usd', 'macro_click_debin']) {
      const label = macroRow(id).label.toLowerCase();
      expect(label).not.toContain('macro');
      expect(label).not.toContain('click de pago');
    }
  });
});
