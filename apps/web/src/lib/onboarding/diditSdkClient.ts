'use client';

import { DiditSdk } from '@didit-protocol/sdk-web';

/**
 * Opens Didit's hosted verification flow in the web SDK modal.
 * The webhook is the source of truth for approval — `onComplete` is UI-only.
 */
export function openDiditVerification(
  url: string,
  onComplete?: (resultType: 'completed' | 'cancelled' | 'failed') => void
): void {
  if (onComplete) {
    DiditSdk.shared.onComplete = (result) => {
      onComplete(result.type);
    };
  }
  DiditSdk.shared.startVerification({ url });
}
