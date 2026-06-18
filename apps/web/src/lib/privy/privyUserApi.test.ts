import { describe, expect, it } from 'vitest';
import { extractVerifiedPrivyEmails } from './privyUserApi';

describe('extractVerifiedPrivyEmails', () => {
  it('collects verified email linked accounts', () => {
    expect(
      extractVerifiedPrivyEmails([
        {
          type: 'email',
          address: 'Investor@Example.com',
          verified_at: 1
        }
      ])
    ).toEqual(['investor@example.com']);
  });

  it('ignores unverified linked accounts', () => {
    expect(
      extractVerifiedPrivyEmails([
        {
          type: 'email',
          address: 'investor@example.com'
        }
      ])
    ).toEqual([]);
  });

  it('includes oauth emails when verified', () => {
    expect(
      extractVerifiedPrivyEmails([
        {
          type: 'google_oauth',
          email: 'investor@example.com',
          latest_verified_at: 1
        }
      ])
    ).toEqual(['investor@example.com']);
  });
});
