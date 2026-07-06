import { describe, expect, it } from 'vitest';
import {
  resolveInvestorAccessForRegistration,
  shouldRejectDisabledAccountRegistration,
  isGhostUserWithoutCredential,
  wouldRejectForMissingInviteCode
} from './registerService';
import { isInvestorOpenRegistration } from './investorAccess';

describe('register investor access policy', () => {
  it('does not re-enable disabled accounts through open registration alone', () => {
    expect(
      resolveInvestorAccessForRegistration({
        existing: { investorAccessEnabled: false },
        openRegistration: true,
        explicitAccessGrant: false,
        inviteCodeGrant: false
      })
    ).toBe(false);
  });

  it('allows new users when open registration is enabled', () => {
    expect(
      resolveInvestorAccessForRegistration({
        existing: null,
        openRegistration: true,
        explicitAccessGrant: false,
        inviteCodeGrant: false
      })
    ).toBe(true);
  });

  it('re-enables disabled accounts with explicit invite or pre-approval grant', () => {
    expect(
      resolveInvestorAccessForRegistration({
        existing: { investorAccessEnabled: false },
        openRegistration: true,
        explicitAccessGrant: true,
        inviteCodeGrant: false
      })
    ).toBe(true);
  });

  it('re-enables disabled accounts with invite code when registration is closed', () => {
    expect(
      resolveInvestorAccessForRegistration({
        existing: { investorAccessEnabled: false },
        openRegistration: false,
        explicitAccessGrant: false,
        inviteCodeGrant: true
      })
    ).toBe(true);
  });

  it('preserves already enabled access', () => {
    expect(
      resolveInvestorAccessForRegistration({
        existing: { investorAccessEnabled: true },
        openRegistration: false,
        explicitAccessGrant: false,
        inviteCodeGrant: false
      })
    ).toBe(true);
  });

  it('rejects password registration for disabled accounts without grant', () => {
    expect(
      shouldRejectDisabledAccountRegistration({
        existing: { investorAccessEnabled: false, passwordHash: null },
        staffOnboarding: false,
        explicitAccessGrant: false,
        inviteCodeGrant: false
      })
    ).toBe(true);
  });

  it('allows disabled account registration with explicit grant', () => {
    expect(
      shouldRejectDisabledAccountRegistration({
        existing: { investorAccessEnabled: false, passwordHash: null },
        staffOnboarding: false,
        explicitAccessGrant: true,
        inviteCodeGrant: false
      })
    ).toBe(false);
  });

  it('allows ghost users to complete registration when open registration is enabled', () => {
    const existing = {
      investorAccessEnabled: false,
      passwordHash: null,
      oauthProvider: null
    };

    expect(isGhostUserWithoutCredential(existing)).toBe(true);
    expect(
      shouldRejectDisabledAccountRegistration({
        existing,
        staffOnboarding: false,
        explicitAccessGrant: false,
        inviteCodeGrant: false,
        openRegistration: true
      })
    ).toBe(false);
    expect(
      resolveInvestorAccessForRegistration({
        existing,
        openRegistration: true,
        explicitAccessGrant: false,
        inviteCodeGrant: false,
        ghostUserWithoutCredential: true
      })
    ).toBe(true);
  });

  it('still rejects disabled accounts with password when open registration alone', () => {
    expect(
      shouldRejectDisabledAccountRegistration({
        existing: { investorAccessEnabled: false, passwordHash: 'hash', oauthProvider: null },
        staffOnboarding: false,
        explicitAccessGrant: false,
        inviteCodeGrant: false,
        openRegistration: true
      })
    ).toBe(true);
  });

  it('never rejects new investors for missing invite when open registration is enabled', () => {
    expect(isInvestorOpenRegistration()).toBe(true);
    expect(
      wouldRejectForMissingInviteCode({
        staffOnboarding: false,
        openRegistration: true,
        investorAccessEnabled: false,
        existing: null
      })
    ).toBe(false);
  });

  it('would reject new investors without invite only when registration is closed', () => {
    expect(
      wouldRejectForMissingInviteCode({
        staffOnboarding: false,
        openRegistration: false,
        investorAccessEnabled: false,
        existing: null
      })
    ).toBe(true);
  });
});
