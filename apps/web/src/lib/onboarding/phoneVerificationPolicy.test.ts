import { describe, expect, it } from 'vitest';
import {
  isContactStepComplete,
  isPhoneVerificationSatisfied,
  requiresPhoneVerification
} from './phoneVerificationPolicy';

describe('phoneVerificationPolicy', () => {
  it('requires OTP only for ADMIN', () => {
    expect(requiresPhoneVerification('ADMIN')).toBe(true);
    expect(requiresPhoneVerification('INVESTOR')).toBe(false);
    expect(requiresPhoneVerification('ADVISOR')).toBe(false);
  });

  it('treats phone verification as satisfied for non-admin roles', () => {
    expect(
      isPhoneVerificationSatisfied({ systemRole: 'INVESTOR', phoneVerifiedAt: null })
    ).toBe(true);
    expect(
      isPhoneVerificationSatisfied({ systemRole: 'ADMIN', phoneVerifiedAt: null })
    ).toBe(false);
  });

  it('completes contact for investors with phone but without OTP', () => {
    expect(
      isContactStepComplete({
        systemRole: 'INVESTOR',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: null,
        phone: '+5492617513426'
      })
    ).toBe(true);
  });

  it('requires OTP-verified phone for admin contact step', () => {
    expect(
      isContactStepComplete({
        systemRole: 'ADMIN',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: null,
        phone: '+5492617513426'
      })
    ).toBe(false);
  });
});
