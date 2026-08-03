/** Privy returns 400 when the authorization quorum is already an additional signer. */
export function isAddSignersAlreadyPresentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  if (!lower) return false;
  return (
    lower.includes('already') ||
    lower.includes('duplicate') ||
    lower.includes('exists') ||
    (lower.includes('400') && lower.includes('signer')) ||
    (lower.includes('bad request') && lower.includes('signer'))
  );
}
