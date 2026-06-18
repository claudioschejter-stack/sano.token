import { isPrivyEnabled } from '../privy/config';

/** When Privy is configured, email OTP (Resend) is deferred until Privy login verifies the address. */
export function defersEmailVerificationToPrivy(): boolean {
  return isPrivyEnabled();
}

export function isEmailVerificationSatisfied(input: {
  emailVerifiedAt?: Date | null;
}): boolean {
  return Boolean(input.emailVerifiedAt);
}
