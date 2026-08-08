/**
 * Which countries each fiat collector reaches, and what the transfer lane should
 * therefore render.
 *
 * This is kept apart from `fiatRailPolicy` because the checkout panels are client
 * components: the policy reads credentials from the environment and Bridge's
 * client pulls in `node:crypto`, neither of which belongs in a browser bundle.
 * What a panel needs is only the country question, which is pure data.
 */

export type FiatRailProviderId = 'macro_click' | 'bridge';

/** Macro's licence is Argentine; nothing else is claimed. */
const MACRO_COLLECTION_COUNTRIES = new Set(['AR']);

/** Countries where Bridge opens a virtual account in the payer's own currency. */
const BRIDGE_VIRTUAL_ACCOUNT_COUNTRIES = new Set([
  'US',
  'EU',
  'GB',
  'CA',
  'AU',
  'MX',
  'BR',
  'CO',
  'DE',
  'FR',
  'ES',
  'IT',
  'NL',
  'PT',
  'IE'
]);

export function macroCollectsIn(country: string): boolean {
  return MACRO_COLLECTION_COUNTRIES.has(country.trim().toUpperCase());
}

export function bridgeCollectsIn(country: string): boolean {
  const c = country.trim().toUpperCase();
  // Argentina stays on Macro even though Bridge lists the region.
  if (macroCollectsIn(c)) {
    return false;
  }
  return BRIDGE_VIRTUAL_ACCOUNT_COUNTRIES.has(c);
}

export type WireLaneRenderer = 'bridge_virtual_account' | 'macro_hosted_form' | 'unavailable';

/**
 * What the transfer lane should put on screen.
 *
 * The panel used to decide this by asking whether a hosted widget URL came back,
 * and none does any more, so it fell through to Bridge for every country —
 * including Argentina, which Bridge deliberately excludes. Asking a provider for
 * an account it will not open shows the investor an error where Macro should have
 * been. Deciding from the provider *and* the country makes that combination
 * impossible to reach.
 */
export function wireLaneRenderer(input: {
  provider: FiatRailProviderId;
  country: string;
}): WireLaneRenderer {
  if (input.provider === 'macro_click') {
    return macroCollectsIn(input.country) ? 'macro_hosted_form' : 'unavailable';
  }
  return bridgeCollectsIn(input.country) ? 'bridge_virtual_account' : 'unavailable';
}
