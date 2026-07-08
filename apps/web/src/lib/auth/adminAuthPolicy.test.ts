import { describe, expect, it } from 'vitest';
import { bypassesTotpGateForRole } from './adminAuthPolicy';

describe('adminAuthPolicy', () => {
  it('bypasses TOTP only for ADMIN', () => {
    expect(bypassesTotpGateForRole('ADMIN')).toBe(true);
    expect(bypassesTotpGateForRole('INVESTOR')).toBe(false);
    expect(bypassesTotpGateForRole('ADVISOR')).toBe(false);
    expect(bypassesTotpGateForRole(null)).toBe(false);
  });
});
