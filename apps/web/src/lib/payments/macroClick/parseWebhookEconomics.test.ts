import { describe, expect, it } from 'vitest';
import {
  parseMacroClickWebhookEconomics,
  parseMacroMontoToMajorUnits
} from './parseWebhookEconomics';

describe('parseMacroMontoToMajorUnits', () => {
  it('parses comma decimal pesos', () => {
    expect(parseMacroMontoToMajorUnits('1500,50')).toBe(1500.5);
  });

  it('treats large integer strings as cents', () => {
    expect(parseMacroMontoToMajorUnits('210000')).toBe(2100);
  });
});

describe('parseMacroClickWebhookEconomics', () => {
  it('reads currency and amounts from InformacionAdicional JSON', () => {
    const economics = parseMacroClickWebhookEconomics({
      Monto: '210000',
      InformacionAdicional: JSON.stringify({
        currency: 'ARS',
        localAmount: 2100,
        amountUsd: 2.1
      })
    });
    expect(economics).toEqual({
      currency: 'ARS',
      localAmount: 2100,
      amountUsd: 2.1
    });
  });

  it('falls back to Monto when additional info is missing', () => {
    const economics = parseMacroClickWebhookEconomics({
      Monto: 1500,
      InformacionAdicional: undefined
    });
    expect(economics.localAmount).toBe(1500);
    expect(economics.currency).toBeNull();
  });

  it('treats USD local amount as amountUsd', () => {
    const economics = parseMacroClickWebhookEconomics({
      Monto: '25.00',
      InformacionAdicional: JSON.stringify({ currency: 'USD', localAmount: 25 })
    });
    expect(economics.currency).toBe('USD');
    expect(economics.amountUsd).toBe(25);
  });
});
