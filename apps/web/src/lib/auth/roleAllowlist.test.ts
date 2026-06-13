import { afterEach, describe, expect, it } from 'vitest';
import {
  isPreApprovedInvestorEmail,
  resolveRoleForEmail,
  resolveRoleForExistingUser,
  resolveRoleFromAllowlist
} from './roleAllowlist';

const ENV_KEYS = [
  'AUTH_ADMIN_EMAILS',
  'AUTH_ADVISOR_MANAGER_EMAILS',
  'AUTH_ADVISOR_EMAILS',
  'AUTH_TREASURY_EMAILS',
  'AUTH_OPERATOR_EMAILS',
  'AUTH_INVESTOR_EMAILS',
  'AUTH_ADMIN_EMAIL',
  'AUTH_DEFAULT_ROLE'
] as const;

function clearRoleEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearRoleEnv();
});

describe('roleAllowlist', () => {
  it('prioritizes higher-privilege allowlist roles', () => {
    process.env.AUTH_ADMIN_EMAILS = 'admin@test.com';
    process.env.AUTH_INVESTOR_EMAILS = 'admin@test.com';

    expect(resolveRoleFromAllowlist('admin@test.com')).toBe('ADMIN');
  });

  it('resolves treasury and operator allowlists', () => {
    process.env.AUTH_TREASURY_EMAILS = 'treasury@test.com';
    process.env.AUTH_OPERATOR_EMAILS = 'operator@test.com';

    expect(resolveRoleFromAllowlist('treasury@test.com')).toBe('TREASURY');
    expect(resolveRoleFromAllowlist('operator@test.com')).toBe('OPERATOR');
  });

  it('promotes existing user when allowlist matches', () => {
    process.env.AUTH_ADMIN_EMAILS = 'promoted@test.com';

    expect(resolveRoleForExistingUser('promoted@test.com', 'INVESTOR')).toBe('ADMIN');
  });

  it('does not downgrade staff via investor allowlist', () => {
    process.env.AUTH_INVESTOR_EMAILS = 'advisor@test.com';

    expect(resolveRoleForExistingUser('advisor@test.com', 'ADVISOR')).toBe('ADVISOR');
  });

  it('falls back to default role for new emails', () => {
    process.env.AUTH_DEFAULT_ROLE = 'INVESTOR';

    expect(resolveRoleForEmail('new@test.com')).toBe('INVESTOR');
  });

  it('detects pre-approved investor emails', () => {
    process.env.AUTH_INVESTOR_EMAILS = 'investor@test.com';

    expect(isPreApprovedInvestorEmail('investor@test.com')).toBe(true);
    expect(isPreApprovedInvestorEmail('other@test.com')).toBe(false);
  });
});
