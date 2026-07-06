import { describe, expect, it } from 'vitest';

function assertCompleteContactSnapshot(snapshot: {
  phone: string | null;
  fullName: string | null;
  portraitPath: string | null;
}) {
  if (!snapshot.phone) {
    throw new Error('CONTACT_PHONE_REQUIRED');
  }

  if (!snapshot.fullName) {
    throw new Error('CONTACT_NAME_REQUIRED');
  }

  if (!snapshot.portraitPath) {
    throw new Error('CONTACT_PORTRAIT_REQUIRED');
  }
}

describe('prize contact snapshot', () => {
  it('requires phone, name and portrait', () => {
    expect(() =>
      assertCompleteContactSnapshot({
        phone: '+542611234567',
        fullName: 'Jane Doe',
        portraitPath: 'avatars/user/portrait.jpg'
      })
    ).not.toThrow();
  });

  it('rejects incomplete snapshots', () => {
    expect(() =>
      assertCompleteContactSnapshot({
        phone: null,
        fullName: 'Jane Doe',
        portraitPath: 'avatars/user/portrait.jpg'
      })
    ).toThrow('CONTACT_PHONE_REQUIRED');
  });
});
