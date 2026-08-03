import { describe, expect, it } from 'vitest';
import { isAddSignersAlreadyPresentError } from './isAddSignersAlreadyPresentError';

describe('isAddSignersAlreadyPresentError', () => {
  it('detects Privy PATCH 400 already-present signer failures', () => {
    expect(isAddSignersAlreadyPresentError(new Error('Bad Request: signer already exists'))).toBe(
      true
    );
    expect(isAddSignersAlreadyPresentError('PATCH failed with 400 for additional signer')).toBe(
      true
    );
  });

  it('ignores unrelated failures', () => {
    expect(isAddSignersAlreadyPresentError(new Error('PRIVY_SESSION_REQUIRED'))).toBe(false);
    expect(isAddSignersAlreadyPresentError(null)).toBe(false);
  });
});
