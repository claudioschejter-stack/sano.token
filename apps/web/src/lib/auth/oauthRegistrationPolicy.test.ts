import { describe, expect, it } from 'vitest';
import { resolveRegistrationCountryFromIp } from './oauthRegistrationPolicy';
import { isCountryBlockedForRegistration } from '../security/blockedCountries';

describe('oauthRegistrationPolicy geo-block parity', () => {
  it('resolveRegistrationCountryFromIp normalizes header country', () => {
    expect(resolveRegistrationCountryFromIp(' ar ')).toBe('AR');
    expect(resolveRegistrationCountryFromIp(null)).toBeNull();
  });

  it('blocks OAuth registration from same countries as password when IP header matches', () => {
    expect(isCountryBlockedForRegistration(resolveRegistrationCountryFromIp('IR'))).toBe(true);
    expect(isCountryBlockedForRegistration(resolveRegistrationCountryFromIp('AR'))).toBe(false);
  });

  it('does not use cookie country for block decision (cookie AR + blocked IP must block)', () => {
    const cookieCountry = resolveRegistrationCountryFromIp('AR');
    const ipCountry = resolveRegistrationCountryFromIp('IR');

    expect(isCountryBlockedForRegistration(cookieCountry)).toBe(false);
    expect(isCountryBlockedForRegistration(ipCountry)).toBe(true);
  });
});
