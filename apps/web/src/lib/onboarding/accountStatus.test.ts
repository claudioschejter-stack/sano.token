import { describe, expect, it } from 'vitest';
import { isAccountOperational } from './accountStatus';

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

  it('requires linked wallet for INVESTOR', () => {
    expect(
      isAccountOperational({
        ...baseUser,
        systemRole: 'INVESTOR',
        walletAddress: '0x1234567890123456789012345678901234567890'
      })
    ).toBe(true);
  });
});
