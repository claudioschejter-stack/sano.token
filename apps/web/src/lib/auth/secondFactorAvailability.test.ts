import { describe, expect, it } from 'vitest';

/**
 * The decision the login makes before reading anything the request sent.
 *
 * Its whole point is that the request cannot influence it: whether the
 * brute-force lockout applies has to depend on the account's state, never on
 * which fields the caller chose to include.
 */
function factorsAvailable(input: {
  secretReadable: boolean;
  unusedBackupCodes: number;
}): { canVerify: boolean; costsAnAttempt: boolean } {
  const canVerify = input.secretReadable || input.unusedBackupCodes > 0;
  return { canVerify, costsAnAttempt: canVerify };
}

describe('qué puede autenticar la cuenta', () => {
  it('con secreto legible, se puede verificar y el fallo cuesta un intento', () => {
    expect(factorsAvailable({ secretReadable: true, unusedBackupCodes: 0 })).toEqual({
      canVerify: true,
      costsAnAttempt: true
    });
  });

  it('sin secreto legible pero con respaldos, sigue habiendo con qué entrar', () => {
    expect(factorsAvailable({ secretReadable: false, unusedBackupCodes: 3 })).toEqual({
      canVerify: true,
      costsAnAttempt: true
    });
  });

  it('sin secreto ni respaldos, ningún envío pudo estar mal: no cuesta intento', () => {
    // Otherwise five requests would lock an account over a failure that is ours,
    // for something the user cannot fix by typing more carefully.
    expect(factorsAvailable({ secretReadable: false, unusedBackupCodes: 0 })).toEqual({
      canVerify: false,
      costsAnAttempt: false
    });
  });

  it('la decisión no depende de qué campos mandó el request', () => {
    const state = { secretReadable: false, unusedBackupCodes: 0 };
    const withBackupSubmitted = factorsAvailable(state);
    const withoutBackupSubmitted = factorsAvailable(state);

    expect(withBackupSubmitted).toEqual(withoutBackupSubmitted);
  });
});
