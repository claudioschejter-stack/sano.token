import { describe, expect, it, vi, beforeEach } from 'vitest';
import { evaluateRegisterEmailPrecheck } from './registerEmailPrecheck';

vi.mock('@sanova/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('../admin/investorInviteService', () => ({
  hasValidInvestorInviteForEmail: vi.fn()
}));

vi.mock('./roleAllowlist', () => ({
  isPreApprovedInvestorEmail: vi.fn()
}));

vi.mock('./investorAccess', () => ({
  isInvestorOpenRegistration: vi.fn(() => true)
}));

import { prisma } from '@sanova/database';
import { hasValidInvestorInviteForEmail } from '../admin/investorInviteService';
import { isPreApprovedInvestorEmail } from './roleAllowlist';

const findUnique = vi.mocked(prisma.user.findUnique);
const hasInvite = vi.mocked(hasValidInvestorInviteForEmail);
const isPreApproved = vi.mocked(isPreApprovedInvestorEmail);

describe('evaluateRegisterEmailPrecheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPreApproved.mockReturnValue(false);
    hasInvite.mockResolvedValue(false);
  });

  it('returns available for unknown email', async () => {
    findUnique.mockResolvedValue(null);

    await expect(evaluateRegisterEmailPrecheck('new@example.com')).resolves.toEqual({
      available: true
    });
  });

  it('returns EMAIL_IN_USE for existing password account', async () => {
    findUnique.mockResolvedValue({
      passwordHash: 'hash',
      oauthProvider: null,
      investorAccessEnabled: true,
      systemRole: 'INVESTOR'
    } as never);

    await expect(evaluateRegisterEmailPrecheck('exists@example.com')).resolves.toEqual({
      available: false,
      reason: 'EMAIL_IN_USE'
    });
  });

  it('allows disabled investor when valid invite grant exists', async () => {
    findUnique.mockResolvedValue({
      passwordHash: null,
      oauthProvider: null,
      investorAccessEnabled: false,
      systemRole: 'INVESTOR'
    } as never);
    hasInvite.mockResolvedValue(true);

    await expect(evaluateRegisterEmailPrecheck('invited@example.com')).resolves.toEqual({
      available: true
    });
  });

  it('returns EMAIL_IN_USE for disabled investor that already has a password', async () => {
    findUnique.mockResolvedValue({
      passwordHash: 'hash',
      oauthProvider: null,
      investorAccessEnabled: false,
      systemRole: 'INVESTOR'
    } as never);

    await expect(evaluateRegisterEmailPrecheck('disabled@example.com')).resolves.toEqual({
      available: false,
      reason: 'EMAIL_IN_USE'
    });
  });

  it('returns OAUTH_ONLY_DISABLED for disabled OAuth-only account', async () => {
    findUnique.mockResolvedValue({
      passwordHash: null,
      oauthProvider: 'google',
      investorAccessEnabled: false,
      systemRole: 'INVESTOR'
    } as never);

    await expect(evaluateRegisterEmailPrecheck('oauth@example.com')).resolves.toEqual({
      available: false,
      reason: 'OAUTH_ONLY_DISABLED'
    });
  });

  it('allows ghost investor without credentials under open registration', async () => {
    findUnique.mockResolvedValue({
      passwordHash: null,
      oauthProvider: null,
      investorAccessEnabled: false,
      systemRole: 'INVESTOR'
    } as never);

    await expect(evaluateRegisterEmailPrecheck('ghost@example.com')).resolves.toEqual({
      available: true
    });
  });

  it('allows OAuth account without password under open registration', async () => {
    findUnique.mockResolvedValue({
      passwordHash: null,
      oauthProvider: 'google',
      investorAccessEnabled: true,
      systemRole: 'INVESTOR'
    } as never);

    await expect(evaluateRegisterEmailPrecheck('oauth-enabled@example.com')).resolves.toEqual({
      available: true
    });
  });
});
