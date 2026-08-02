/** True when Prisma closed an interactive transaction due to timeout/expiry. */
export function isPrismaTransactionTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  return (
    lower.includes('transaction already closed') ||
    lower.includes('expired transaction') ||
    lower.includes('interactive transaction timeout') ||
    lower.includes('transaction api error')
  );
}
