import { describe, expect, it } from 'vitest';
import {
  isContactStepComplete,
  isPhoneVerificationSatisfied,
  requiresPhoneVerification
} from './phoneVerificationPolicy';

describe('phoneVerificationPolicy', () => {
  it('does not require OTP for any role', () => {
    expect(requiresPhoneVerification('ADMIN')).toBe(false);
    expect(requiresPhoneVerification('INVESTOR')).toBe(false);
    expect(requiresPhoneVerification('ADVISOR')).toBe(false);
  });

  it('treats phone verification as satisfied for all roles', () => {
    expect(
      isPhoneVerificationSatisfied({ systemRole: 'INVESTOR', phoneVerifiedAt: null })
    ).toBe(true);
    expect(
      isPhoneVerificationSatisfied({ systemRole: 'ADMIN', phoneVerifiedAt: null })
    ).toBe(true);
  });

  it('completes contact with phone captured but without OTP', () => {
    expect(
      isContactStepComplete({
        systemRole: 'INVESTOR',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: null,
        phone: '+5492617513426'
      })
    ).toBe(true);
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
      expect(
        isContactStepComplete({
          systemRole: 'ADMIN',
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          phone: '+5492617513426'
        })
      ).toBe(false);
      expect(
        isContactStepComplete({
          systemRole: 'INVESTOR',
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: null,
          phone: '+5492617513426'
        })
      ).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_PRIVY_APP_ID;
      } else {
        process.env.NEXT_PUBLIC_PRIVY_APP_ID = previous;
      }
    }
  });
});
