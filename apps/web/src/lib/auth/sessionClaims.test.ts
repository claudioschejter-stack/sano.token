import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, is2faLocked, issueTempTotpToken, lockoutRemainingSeconds, isAccountOperational } =
  vi.hoisted(() => ({
    findUnique: vi.fn(),
    is2faLocked: vi.fn(),
    issueTempTotpToken: vi.fn(),
    lockoutRemainingSeconds: vi.fn(),
    isAccountOperational: vi.fn()
  }));

vi.mock('@sanova/database', () => ({
  prisma: {
    user: {
      findUnique
    }
  }
}));

vi.mock('./totpService', () => ({
  is2faLocked,
  issueTempTotpToken,
  lockoutRemainingSeconds
}));

vi.mock('../onboarding/accountStatus', () => ({
  isAccountOperational
}));

import { applyOAuthTotpGate, OAuthTotpLockedError } from './sessionClaims';

describe('applyOAuthTotpGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    is2faLocked.mockReturnValue(false);
    issueTempTotpToken.mockResolvedValue('temp-token-123');
    isAccountOperational.mockReturnValue(true);
  });

  it('defers session when TOTP is enabled', async () => {
    findUnique.mockResolvedValue({ totpEnabled: true, locked2faUntil: null });

    const result = await applyOAuthTotpGate('user-1', {
      accessToken: 'jwt-access',
      role: 'INVESTOR',
      roles: ['INVESTOR']
    });

    expect(result.totpPending).toBe(true);
    expect(result.pendingTotpToken).toBe('temp-token-123');
    expect(result.accessToken).toBeUndefined();
    expect(result.accountOperational).toBe(false);
  });

  it('returns full session when TOTP is disabled', async () => {
    findUnique.mockResolvedValue({ totpEnabled: false, locked2faUntil: null });

    const result = await applyOAuthTotpGate('user-1', {
      accessToken: 'jwt-access',
      role: 'INVESTOR',
      roles: ['INVESTOR']
    });

    expect(result.totpPending).toBe(false);
    expect(result.accessToken).toBe('jwt-access');
    expect(result.accountOperational).toBe(true);
  });

  it('throws when account is locked', async () => {
    findUnique.mockResolvedValue({ totpEnabled: true, locked2faUntil: new Date(Date.now() + 60_000) });
    is2faLocked.mockReturnValue(true);
    lockoutRemainingSeconds.mockReturnValue(900);

    await expect(
      applyOAuthTotpGate('user-1', {
        accessToken: 'jwt-access',
        role: 'INVESTOR',
        roles: ['INVESTOR']
      })
    ).rejects.toBeInstanceOf(OAuthTotpLockedError);
  });
});
