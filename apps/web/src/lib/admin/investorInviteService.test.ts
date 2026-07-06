import { describe, expect, it } from 'vitest';

/** Mirrors invite access filter in hasValidInvestorInviteForEmail / resolveInvestorInvitePhoneForEmail. */
function isInvestorInviteAccessible(input: {
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: Date;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();

  if (input.status === 'ACCEPTED') {
    return true;
  }

  if (input.status === 'PENDING') {
    return input.expiresAt.getTime() > now.getTime();
  }

  return false;
}

describe('investor invite access policy', () => {
  const now = new Date('2026-07-05T12:00:00.000Z');
  const expired = new Date('2026-06-01T12:00:00.000Z');
  const valid = new Date('2026-08-01T12:00:00.000Z');

  it('accepts ACCEPTED invites even when expiresAt is in the past', () => {
    expect(
      isInvestorInviteAccessible({
        status: 'ACCEPTED',
        expiresAt: expired,
        now
      })
    ).toBe(true);
  });

  it('rejects PENDING invites when expiresAt is in the past', () => {
    expect(
      isInvestorInviteAccessible({
        status: 'PENDING',
        expiresAt: expired,
        now
      })
    ).toBe(false);
  });

  it('accepts PENDING invites when expiresAt is in the future', () => {
    expect(
      isInvestorInviteAccessible({
        status: 'PENDING',
        expiresAt: valid,
        now
      })
    ).toBe(true);
  });
});
