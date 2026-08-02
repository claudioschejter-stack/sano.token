import { describe, expect, it } from 'vitest';
import { isPrismaTransactionTimeoutError } from './prismaTransactionErrors';

describe('isPrismaTransactionTimeoutError', () => {
  it('detects Prisma interactive transaction expiry', () => {
    expect(
      isPrismaTransactionTimeoutError(
        new Error(
          'Invalid `prisma.project.findUnique()` invocation: Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5059 ms passed since the start of the transaction.'
        )
      )
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isPrismaTransactionTimeoutError(new Error('INSUFFICIENT_SUPPLY'))).toBe(false);
    expect(isPrismaTransactionTimeoutError(null)).toBe(false);
  });
});
