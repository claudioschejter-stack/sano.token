/** Pre-check / access errors that block both password submit and OAuth on register. */
const REGISTER_OAUTH_BLOCK_CODES = new Set([
  'OAUTH_ONLY_DISABLED',
  'INVESTOR_ACCESS_NOT_ENABLED',
  'REGION_NOT_AVAILABLE',
  'EMAIL_CHECK_FAILED'
]);

export function isRegisterOAuthBlocked(errorCode: string | null | undefined): boolean {
  return Boolean(errorCode && REGISTER_OAUTH_BLOCK_CODES.has(errorCode));
}
