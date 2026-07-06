import { describe, expect, it } from 'vitest';
import { assertInvestorCheckoutEligible } from './investorService';
import type { KycStatus, AccountStatus } from '@sanova/database';

const baseUser = {
  id: 'user-1',
  email: 'test@example.com',
  phone: '+542611234567',
  kycFullName: 'Jane Doe',
  kycDocumentId: '12345678',
  kycStatus: 'APPROVED' as KycStatus,
  accountStatus: 'ONBOARDING' as AccountStatus,
  emailVerifiedAt: new Date(),
  phoneVerifiedAt: new Date(),
  walletAddress: '0x1234567890123456789012345678901234567890',
  investorId: 'inv-1',
  investorAccessEnabled: true,
  systemRole: 'INVESTOR',
  totpEnabled: false
};

describe('assertInvestorCheckoutEligible', () => {
  it('rejects checkout when TOTP is required but not enabled', () => {
    expect(() => assertInvestorCheckoutEligible(baseUser)).toThrow('TOTP_REQUIRED');
  });

  it('allows checkout when TOTP is enabled', () => {
    expect(() =>
      assertInvestorCheckoutEligible({
        ...baseUser,
        totpEnabled: true
      })
    ).not.toThrow();
  });

  it('rejects checkout when KYC is not approved', () => {
    expect(() =>
      assertInvestorCheckoutEligible({
        ...baseUser,
        kycStatus: 'PENDING',
        totpEnabled: true
      })
    ).toThrow('KYC_NOT_APPROVED');
  });
});
