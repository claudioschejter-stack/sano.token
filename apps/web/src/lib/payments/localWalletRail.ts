import { isMacroClickConfigured } from './macroClick/config';
import { getBridgeApiKey } from './bridgeClient';
import { normalizePaymentCountry, isPaymentCountrySanctioned } from './paymentCountry';

/**
 * One local rail per country, instead of one integration per wallet.
 *
 * Mercado Pago, Ualá, Lemon, Belo and Naranja X all read the same Argentine
 * interoperable QR. Nubank, PicPay and Inter all read the same Pix code. They
 * are not separate integrations: they are separate front doors to the same
 * national rail, and integrating them one by one is the wrong axis. Picking the
 * rail from the investor's country is what turns fourteen payment options into a
 * single button.
 *
 * The investor never chooses a provider here. They see the name of the thing
 * they already use to pay for coffee.
 */

export type LocalRailId = 'pix' | 'spei' | 'bre_b' | 'ars_bank' | 'sepa' | 'ach' | 'fps';

export type LocalRailPresentation =
  /** A code the investor's wallet scans, or their phone opens directly. */
  | 'qr'
  /** Account details to copy into their banking app. */
  | 'account_details'
  /** The provider's own hosted page. */
  | 'hosted';

export type LocalWalletRail = {
  railId: LocalRailId;
  /** What the button says: the rail's own name where people know it. */
  label: string;
  /** Provider that actually collects the money. */
  provider: 'bridge' | 'macro_click';
  presentation: LocalRailPresentation;
  /** Settles in seconds or minutes, as opposed to business days. */
  instant: boolean;
  settlementHint: string;
  /** False when the provider is not configured in this environment. */
  configured: boolean;
};

export type LocalWalletRailResolution =
  | { available: true; rail: LocalWalletRail }
  | { available: false; reason: 'SANCTIONED_COUNTRY' | 'NO_LOCAL_RAIL' | 'PROVIDER_NOT_CONFIGURED'; country: string; rail?: LocalWalletRail };

const EUR_COUNTRIES = new Set([
  'EU', 'DE', 'FR', 'ES', 'IT', 'NL', 'PT', 'IE', 'AT', 'BE', 'FI', 'GR', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'CY', 'MT'
]);

/**
 * The rail a country's wallets speak, before asking whether it is switched on.
 * Kept separate from availability so the UI can explain "coming soon" rather
 * than pretending the country has no rail at all.
 */
function railForCountry(country: string): Omit<LocalWalletRail, 'configured'> | null {
  if (country === 'BR') {
    return {
      railId: 'pix',
      label: 'Pix',
      provider: 'bridge',
      presentation: 'qr',
      instant: true,
      settlementHint: 'Llega en minutos'
    };
  }
  if (country === 'MX') {
    return {
      railId: 'spei',
      label: 'SPEI',
      provider: 'bridge',
      presentation: 'account_details',
      instant: true,
      settlementHint: 'Llega en segundos, las 24 horas'
    };
  }
  if (country === 'CO') {
    return {
      railId: 'bre_b',
      label: 'Bre-B',
      provider: 'bridge',
      presentation: 'account_details',
      instant: true,
      settlementHint: 'Llega en minutos'
    };
  }
  if (country === 'AR') {
    /** Bridge issues no ARS virtual accounts, so Argentina runs on Macro. */
    return {
      railId: 'ars_bank',
      label: 'Transferencia o billetera',
      provider: 'macro_click',
      presentation: 'hosted',
      instant: true,
      settlementHint: 'Llega en minutos'
    };
  }
  if (EUR_COUNTRIES.has(country)) {
    return {
      railId: 'sepa',
      label: 'SEPA',
      provider: 'bridge',
      presentation: 'account_details',
      instant: false,
      settlementHint: '1 a 2 días hábiles'
    };
  }
  if (country === 'GB') {
    return {
      railId: 'fps',
      label: 'Faster Payments',
      provider: 'bridge',
      presentation: 'account_details',
      instant: true,
      settlementHint: 'Llega en minutos'
    };
  }
  if (country === 'US') {
    return {
      railId: 'ach',
      label: 'Transferencia bancaria',
      provider: 'bridge',
      presentation: 'account_details',
      instant: false,
      settlementHint: '1 a 3 días hábiles'
    };
  }
  return null;
}

function providerConfigured(provider: LocalWalletRail['provider']): boolean {
  return provider === 'macro_click' ? isMacroClickConfigured() : Boolean(getBridgeApiKey());
}

/** The single local option to offer this investor, or why there is none. */
export function resolveLocalWalletRail(countryInput?: string | null): LocalWalletRailResolution {
  const country = normalizePaymentCountry(countryInput);

  if (isPaymentCountrySanctioned(country)) {
    return { available: false, reason: 'SANCTIONED_COUNTRY', country };
  }

  const base = railForCountry(country);
  if (!base) {
    return { available: false, reason: 'NO_LOCAL_RAIL', country };
  }

  const configured = providerConfigured(base.provider);
  const rail: LocalWalletRail = { ...base, configured };

  if (!configured) {
    return { available: false, reason: 'PROVIDER_NOT_CONFIGURED', country, rail };
  }

  return { available: true, rail };
}

/** Every country with a rail, for admin visibility into real coverage. */
export function localWalletRailCoverage(): Array<{ country: string; rail: LocalWalletRail }> {
  const countries = ['AR', 'BR', 'MX', 'CO', 'US', 'GB', ...EUR_COUNTRIES];
  const seen = new Set<string>();
  const rows: Array<{ country: string; rail: LocalWalletRail }> = [];

  for (const country of countries) {
    if (seen.has(country)) continue;
    seen.add(country);
    const base = railForCountry(country);
    if (!base) continue;
    rows.push({ country, rail: { ...base, configured: providerConfigured(base.provider) } });
  }

  return rows;
}
