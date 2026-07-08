/**
 * Didit workflow IDs — per-session config, not secrets and not env vars.
 * @see https://docs.didit.me/sessions-api/create-session
 */

/** Custom KYC — free-tier onboarding (ID, liveness, face match, IP). */
export const INVESTOR_KYC_WORKFLOW_ID = 'b722c869-04ad-4b6c-bf4c-e22ded12575d';

/** KYC + AML — includes paid AML module; use when workspace has prepaid credits. */
export const KYC_AML_WORKFLOW_ID = '1fabc54a-646c-474a-abad-7f164ff2c33f';

/**
 * Biometric Authentication — re-auth against a prior portrait (requires `portrait_image` on create).
 * Not used for first-time onboarding.
 */
export const BIOMETRIC_AUTH_WORKFLOW_ID = 'a3d189c3-bcc7-4232-9fbd-98b694fc0b77';
