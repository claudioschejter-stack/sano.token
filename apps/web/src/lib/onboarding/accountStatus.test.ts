import { describe, expect, it } from 'vitest';
import { buildOnboardingChecklist, isAccountOperational, requiresTotpSetup } from './accountStatus';

const baseUser = {
  email: 'user@example.com',
  phone: '+5492617513426',
  emailVerifiedAt: new Date(),
  phoneVerifiedAt: new Date(),
  kycStatus: 'APPROVED' as const,
  accountStatus: 'ONBOARDING' as const,
  walletAddress: '0x1234567890123456789012345678901234567890',
  systemRole: 'ADMIN'
};

const investorUser = {
  ...baseUser,
  systemRole: 'INVESTOR' as const
};

describe('buildOnboardingChecklist email gate', () => {
  it('blocks KYC until email is verified for investors', () => {
    const checklist = buildOnboardingChecklist(
      {
        email: 'investor@example.com',
        phone: '+5492617513426',
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        kycStatus: 'PENDING',
        accountStatus: 'ONBOARDING',
        walletAddress: null,
        systemRole: 'INVESTOR',
        totpEnabled: false
      },
      true
    );

    expect(checklist.emailVerified).toBe(false);
    expect(checklist.kycEnabled).toBe(false);
  });

  it('enables KYC after email and phone verification', () => {
    const checklist = buildOnboardingChecklist(
      {
        email: 'investor@example.com',
        phone: '+5492617513426',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        kycStatus: 'PENDING',
        accountStatus: 'ONBOARDING',
        walletAddress: null,
        systemRole: 'INVESTOR',
        totpEnabled: false
      },
      true
    );

    expect(checklist.emailVerified).toBe(true);
    expect(checklist.phoneVerified).toBe(true);
    expect(checklist.kycEnabled).toBe(true);
  });

  it('blocks KYC until phone OTP is verified for investors', () => {
    const checklist = buildOnboardingChecklist(
      {
        email: 'investor@example.com',
        phone: '+5492617513426',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: null,
        kycStatus: 'PENDING',
        accountStatus: 'ONBOARDING',
        walletAddress: null,
        systemRole: 'INVESTOR',
        totpEnabled: false
      },
      true
    );

    expect(checklist.emailVerified).toBe(true);
    expect(checklist.kycEnabled).toBe(false);
  });
});

describe('isAccountOperational wallet policy', () => {
  it('requires linked wallet for ADMIN', () => {
    expect(isAccountOperational(baseUser)).toBe(true);
    expect(isAccountOperational({ ...baseUser, walletAddress: null })).toBe(false);
  });

  it('requires linked wallet for TREASURY', () => {
    expect(
      isAccountOperational({
        ...baseUser,
        systemRole: 'TREASURY',
        walletAddress: '0x1234567890123456789012345678901234567890'
      })
    ).toBe(true);
    expect(
      isAccountOperational({
        ...baseUser,
        systemRole: 'TREASURY',
        walletAddress: null
      })
    ).toBe(false);
  });

  it('requires linked wallet and TOTP for INVESTOR', () => {
    expect(
      isAccountOperational({
        ...baseUser,
        systemRole: 'INVESTOR',
        walletAddress: '0x1234567890123456789012345678901234567890',
        totpEnabled: true
      })
    ).toBe(true);
    expect(
      isAccountOperational({
        ...baseUser,
        systemRole: 'INVESTOR',
        walletAddress: '0x1234567890123456789012345678901234567890',
        totpEnabled: false
      })
    ).toBe(false);
  });
});

describe('requiresTotpSetup', () => {
  it('requires TOTP for investors with KYC approved and linked wallet', () => {
    expect(requiresTotpSetup(investorUser)).toBe(true);
    expect(requiresTotpSetup({ ...investorUser, walletAddress: null })).toBe(false);
    expect(requiresTotpSetup({ ...investorUser, kycStatus: 'PENDING' })).toBe(false);
  });

  it('does not require TOTP for platform ops roles', () => {
    expect(requiresTotpSetup(baseUser)).toBe(false);
    expect(requiresTotpSetup({ ...baseUser, systemRole: 'TREASURY' })).toBe(false);
  });
});

describe('isAccountOperational TOTP policy', () => {
  it('blocks INVESTOR without TOTP when KYC and wallet are ready', () => {
    expect(isAccountOperational({ ...investorUser, totpEnabled: false })).toBe(false);
    expect(isAccountOperational({ ...investorUser, totpEnabled: true })).toBe(true);
  });

  it('does not require TOTP for ADMIN even without totpEnabled', () => {
    expect(isAccountOperational({ ...baseUser, totpEnabled: false })).toBe(true);
  });
});
