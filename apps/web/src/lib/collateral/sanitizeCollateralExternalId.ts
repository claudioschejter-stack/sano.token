import type { CollateralProtocol } from '../admin/launchTypes';
import { isMorphoMarketId } from '../lending/protocols/morphoBorrow';

/**
 * Keep `externalId` meaningful per protocol.
 *
 * For Morpho it is the market id and nothing else. A placeholder that merely
 * looks like an identifier is worse than an empty field: the field reads as
 * populated, so nobody investigates, while every consumer quietly falls back to
 * recomputing the id from assumed parameters. That fallback is what read a
 * market holding real USDC as empty.
 */
export function sanitizeCollateralExternalId(
  protocol: CollateralProtocol | string,
  externalId: string | null | undefined
): string | null {
  const raw = externalId?.trim();
  if (!raw) {
    return null;
  }
  if (protocol !== 'MORPHO') {
    return raw;
  }
  return isMorphoMarketId(raw) ? raw : null;
}
