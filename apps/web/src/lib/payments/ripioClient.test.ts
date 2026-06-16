import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  formatRipioFiatInstructions,
  resolveRipioFiatAmount,
  verifyRipioWebhookSignature
} from './ripioClient';

describe('ripioClient', () => {
  it('formats argentine bank instructions', () => {
    const text = formatRipioFiatInstructions({
      cvu: '0000465160000000070078',
      alias: 'sanova.ramp'
    });
    expect(text).toContain('CVU: 0000465160000000070078');
    expect(text).toContain('Alias: sanova.ramp');
  });

  it('converts usd to ars quote amount', () => {
    process.env.RIPIO_FX_ARS = '1000';
    const fiat = resolveRipioFiatAmount(10);
    expect(fiat.currency).toBe('ARS');
    expect(fiat.amount).toBe('10000.00');
  });

  it('validates webhook signatures', () => {
    const secret = 'ripio-test-secret';
    const payload = '{"eventType":"ON-RAMP.WITHDRAWAL.COMPLETED"}';
    const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

    expect(
      verifyRipioWebhookSignature({
        secret,
        payload,
        signature
      })
    ).toBe(true);
  });
});
