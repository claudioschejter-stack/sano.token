import { describe, expect, it } from 'vitest';
import {
  isContactStepComplete,
  isPhoneVerificationSatisfied,
  requiresPhoneVerification
} from './phoneVerificationPolicy';

describe('phoneVerificationPolicy', () => {
  it('requires OTP for marketplace-facing roles only', () => {
    expect(requiresPhoneVerification('ADMIN')).toBe(false);
    expect(requiresPhoneVerification('INVESTOR')).toBe(true);
    expect(requiresPhoneVerification('ADVISOR')).toBe(true);
    expect(requiresPhoneVerification('TREASURY')).toBe(false);
  });

  it('requires phoneVerifiedAt for roles with OTP enabled', () => {
    expect(
      isPhoneVerificationSatisfied({ systemRole: 'INVESTOR', phoneVerifiedAt: null })
    ).toBe(false);
    expect(
      isPhoneVerificationSatisfied({ systemRole: 'INVESTOR', phoneVerifiedAt: new Date() })
    ).toBe(true);
    expect(
      isPhoneVerificationSatisfied({ systemRole: 'ADMIN', phoneVerifiedAt: null })
    ).toBe(true);
  });

  it('completes contact when email and phone requirements are met', () => {
    expect(
      isContactStepComplete({
        systemRole: 'INVESTOR',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        phone: '+5492617513426'
      })
    ).toBe(true);
    expect(
      isContactStepComplete({
        systemRole: 'INVESTOR',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: null,
        phone: '+5492617513426'
      })
    ).toBe(false);
    expect(
      isContactStepComplete({
        systemRole: 'ADMIN',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: null,
        phone: '+5492617513426'
      })
    ).toBe(true);
  });

  it('requires verified email before contact is complete', () => {
    const previous = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'cmqiztako002p0bjmjiqaebuw';

    try {
      expect(
        isContactStepComplete({
          systemRole: 'INVESTOR',
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          phone: '+5492617513426'
        })
      ).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
      } else {
        process.env.NEXT_PUBLIC_PRIVY_APP_ID = previous;
      }
    }
  });
});
