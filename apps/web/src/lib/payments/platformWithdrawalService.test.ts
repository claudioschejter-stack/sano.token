import { describe, expect, it } from 'vitest';
import { normalizeFiatPayoutDetails } from './platformWithdrawalService';

describe('normalizeFiatPayoutDetails', () => {
  it('accepts bank/wallet rail with CBU', () => {
    expect(
      normalizeFiatPayoutDetails({
        rail: 'BANK_OR_WALLET',
        accountHolderName: 'Juan Perez',
        taxId: '20123456789',
        cbuOrCvu: '0000003100010000000001'
      })
    ).toMatchObject({
      rail: 'BANK_OR_WALLET',
      accountHolderName: 'Juan Perez',
      taxId: '20123456789',
      cbuOrCvu: '0000003100010000000001'
    });
  });

  it('accepts alias instead of CBU', () => {
    expect(
      normalizeFiatPayoutDetails({
        rail: 'BANK_OR_WALLET',
        accountHolderName: 'Maria',
        taxId: '27987654321',
        alias: 'maria.mp'
      }).alias
    ).toBe('maria.mp');
  });

  it('accepts OTHER rail with notes', () => {
    expect(
      normalizeFiatPayoutDetails({
        rail: 'OTHER',
        accountHolderName: 'Acme',
        taxId: '30-123',
        notes: 'PayPal: acme@example.com'
      }).notes
    ).toBe('PayPal: acme@example.com');
  });

  it('rejects incomplete bank details', () => {
    expect(() =>
      normalizeFiatPayoutDetails({
        rail: 'BANK_OR_WALLET',
        accountHolderName: 'Juan',
        taxId: '20'
      })
    ).toThrow('PAYOUT_DETAILS_INCOMPLETE');
  });

  it('rejects OTHER without notes', () => {
    expect(() =>
      normalizeFiatPayoutDetails({
        rail: 'OTHER',
        accountHolderName: 'Juan',
        taxId: '20'
      })
    ).toThrow('PAYOUT_DETAILS_INCOMPLETE');
  });

  it('accepts Bridge external account without CBU/alias', () => {
    expect(
      normalizeFiatPayoutDetails({
        rail: 'BANK_OR_WALLET',
        accountHolderName: 'Ada Lovelace',
        bridgeExternalAccountId: 'ea_123',
        bridgeCurrency: 'usd'
      })
    ).toMatchObject({
      bridgeExternalAccountId: 'ea_123',
      bridgeCurrency: 'usd',
      providerName: 'bridge'
    });
  });
});
