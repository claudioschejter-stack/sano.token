import { describe, expect, it } from 'vitest';
import {
  buildDLocalGoOpenCheckoutUrl,
  dlocalGoOpenLinkToken,
  isDLocalGoMode
} from './dlocalGoAdapter';

describe('dlocalGoAdapter', () => {
  it('detects Go mode from merchant id', () => {
    process.env.DLOCAL_GO_MERCHANT_ID = '230197';
    expect(isDLocalGoMode()).toBe(true);
    expect(dlocalGoOpenLinkToken()).toBe(Buffer.from('open_link:mid:230197', 'utf8').toString('base64'));
    delete process.env.DLOCAL_GO_MERCHANT_ID;
  });

  it('builds open checkout url with amount and reference', () => {
    process.env.DLOCAL_GO_MERCHANT_ID = '230197';
    const url = buildDLocalGoOpenCheckoutUrl({
      amountLocal: 1050,
      currency: 'ARS',
      externalId: 'dep-123',
      successUrl: 'https://www.sanovacapital.com/ok',
      backUrl: 'https://www.sanovacapital.com/back'
    });
    expect(url).toContain('https://checkout.dlocalgo.com/open-checkout/');
    expect(url).toContain('amount=1050.00');
    expect(url).toContain('external_id=dep-123');
    delete process.env.DLOCAL_GO_MERCHANT_ID;
  });
});
