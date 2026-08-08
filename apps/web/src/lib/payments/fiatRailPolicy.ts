/**
 * Who collects the money for each fiat lane, in one place.
 *
 * The rule is Macro wherever Macro can collect, Bridge wherever it cannot. It
 * used to be spelled out twice — once in the country recommendation and once in
 * the checkout resolver — and the two drifted: the recommendation still named a
 * provider that had already been retired while the resolver had moved on. A lane
 * that advertises a provider the resolver will not use is worse than no
 * recommendation at all, because the investor only finds out at the last step.
 *
 * Bitso Business is being evaluated as an additional collector. When it is
 * signed it becomes another entry in the ordered preference below rather than a
 * new branch in each panel.
 *
 * The country questions live in `fiatRailCoverage` so client components can ask
 * them without importing anything that reads credentials.
 */

import { isMacroClickConfigured } from './macroClick/config';
import { bridgeCollectsIn, macroCollectsIn, type FiatRailProviderId } from './fiatRailCoverage';

export { bridgeCollectsIn, macroCollectsIn, wireLaneRenderer } from './fiatRailCoverage';
export type { FiatRailProviderId, WireLaneRenderer } from './fiatRailCoverage';

export type FiatRailKind = 'card' | 'transfer';

export type FiatRailUnavailableReason =
  /** Macro's licence is Argentine and Bridge does not reach this country. */
  | 'no_collector_for_country'
  /** The country's collector exists but its credentials are missing. */
  | 'collector_not_configured'
  /** Cards need a card acquirer; Bridge only opens bank accounts. */
  | 'no_card_acquirer_for_country';

export type FiatRailDecision = {
  /** The provider the checkout will actually use, or null when the lane is closed. */
  provider: FiatRailProviderId | null;
  configured: boolean;
  reason: FiatRailUnavailableReason | null;
};

export function resolveFiatRail(input: {
  country: string;
  kind: FiatRailKind;
  macroConfigured?: boolean;
  bridgeConfigured: boolean;
}): FiatRailDecision {
  const country = input.country.trim().toUpperCase();
  const macroConfigured = input.macroConfigured ?? isMacroClickConfigured();

  if (macroCollectsIn(country)) {
    return macroConfigured
      ? { provider: 'macro_click', configured: true, reason: null }
      : { provider: 'macro_click', configured: false, reason: 'collector_not_configured' };
  }

  /**
   * Bridge opens a virtual account in the payer's own currency; it is a bank
   * rail, not a card acquirer. Offering it as a card would put a button in front
   * of an investor that cannot take a card number.
   */
  if (input.kind === 'card') {
    return { provider: null, configured: false, reason: 'no_card_acquirer_for_country' };
  }

  if (bridgeCollectsIn(country)) {
    return input.bridgeConfigured
      ? { provider: 'bridge', configured: true, reason: null }
      : { provider: 'bridge', configured: false, reason: 'collector_not_configured' };
  }

  return { provider: null, configured: false, reason: 'no_collector_for_country' };
}
