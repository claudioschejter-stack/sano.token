import { isPrivyOnRampConfigured } from './privyOnRampPolicy';
import { isPrivyEnabled } from '../privy/config';
import { resolveLocalWalletRail, type LocalWalletRail } from './localWalletRail';
import { normalizePaymentCountry, isPaymentCountrySanctioned } from './paymentCountry';

/**
 * The four ways to pay, in every country.
 *
 * Not four providers: four things an investor recognises. Behind each one the
 * provider changes by country — Pix in Brazil, SPEI in Mexico, Macro in
 * Argentina — and that is exactly what the investor should never have to think
 * about. A catalogue of fourteen named providers asked them to choose between
 * things they have no way to compare.
 *
 * Keeping the four fixed also makes the gaps legible: instead of "we support 14
 * methods", the honest question becomes "which of the four works in Mexico, and
 * what is missing for the rest".
 */

export type CheckoutOptionKind =
  | 'crypto_wallet'
  | 'virtual_wallet'
  | 'debit_card'
  | 'bank_transfer';

export type CheckoutOptionPresentation =
  /** Send from a crypto wallet to an address, usually by scanning. */
  | 'crypto_transfer'
  /** A code the country's wallets scan. */
  | 'qr'
  /** Account details to paste into a banking or wallet app. */
  | 'account_details'
  /** The provider's own hosted page. */
  | 'hosted'
  /** Completed inside Sanova, without leaving. */
  | 'in_app';

export type CheckoutOptionStatus = {
  kind: CheckoutOptionKind;
  available: boolean;
  /** Who actually collects the money here, or null when nobody does yet. */
  provider: string | null;
  presentation: CheckoutOptionPresentation;
  /** What the investor is told to expect. */
  settlementHint: string;
  /** In operator terms, what is missing. Null when it works. */
  missing: string | null;
};

export type CountryCheckoutCoverage = {
  country: string;
  options: CheckoutOptionStatus[];
};

/** Rails an investor pays from a wallet app, as opposed to a bank app. */
function railIsWalletReadable(rail: LocalWalletRail): boolean {
  return rail.presentation === 'qr' || rail.railId === 'spei' || rail.railId === 'bre_b';
}

function cryptoWallet(): CheckoutOptionStatus {
  const ready = isPrivyEnabled();
  return {
    kind: 'crypto_wallet',
    available: ready,
    provider: ready ? 'sanova' : null,
    presentation: 'crypto_transfer',
    settlementHint: 'Se acredita en cuanto la red confirma, en segundos',
    missing: ready ? null : 'Configurar Privy (PRIVY_APP_ID y PRIVY_APP_SECRET).'
  };
}

function debitCard(): CheckoutOptionStatus {
  const ready = isPrivyOnRampConfigured();
  return {
    kind: 'debit_card',
    available: ready,
    provider: ready ? 'privy' : null,
    presentation: 'in_app',
    settlementHint: 'El USDC entra a tu wallet Sanova al aprobarse la tarjeta',
    missing: ready ? null : 'Configurar NEXT_PUBLIC_PRIVY_APP_ID.'
  };
}

function virtualWallet(country: string): CheckoutOptionStatus {
  const resolution = resolveLocalWalletRail(country);
  const rail = resolution.available ? resolution.rail : resolution.rail;

  /**
   * A rail nobody can pay from a wallet app is not a wallet option. Argentina
   * is the case that matters: Macro is a bank form, so the country with the
   * highest wallet adoption in the region has no wallet button.
   */
  if (!rail || !railIsWalletReadable(rail)) {
    return {
      kind: 'virtual_wallet',
      available: false,
      provider: null,
      presentation: 'qr',
      settlementHint: '—',
      missing:
        country === 'AR'
          ? 'Argentina no tiene riel de billetera: hace falta un cobro por QR interoperable (Mercado Pago o Bitso) con conversión automática a USDC.'
          : 'Este país no tiene un riel que las billeteras locales puedan pagar.'
    };
  }

  return {
    kind: 'virtual_wallet',
    available: resolution.available,
    provider: resolution.available ? rail.provider : null,
    presentation: rail.presentation === 'qr' ? 'qr' : 'account_details',
    settlementHint: rail.settlementHint,
    missing: resolution.available
      ? null
      : `Habilitar ${rail.label} con el proveedor (${rail.provider}).`
  };
}

function bankTransfer(country: string): CheckoutOptionStatus {
  const resolution = resolveLocalWalletRail(country);
  const rail = resolution.available ? resolution.rail : resolution.rail;

  if (!rail) {
    return {
      kind: 'bank_transfer',
      available: false,
      provider: null,
      presentation: 'account_details',
      settlementHint: '—',
      missing: 'No hay riel bancario configurado para este país.'
    };
  }

  return {
    kind: 'bank_transfer',
    available: resolution.available,
    provider: resolution.available ? rail.provider : null,
    presentation: rail.presentation === 'hosted' ? 'hosted' : 'account_details',
    settlementHint: rail.settlementHint,
    missing: resolution.available
      ? null
      : `Habilitar ${rail.label} con el proveedor (${rail.provider}).`
  };
}

/** The four options for one country, each with why it does or does not work. */
export function checkoutCoverageForCountry(countryInput?: string | null): CountryCheckoutCoverage {
  const country = normalizePaymentCountry(countryInput);

  if (isPaymentCountrySanctioned(country)) {
    const blocked: CheckoutOptionStatus[] = (
      ['crypto_wallet', 'virtual_wallet', 'debit_card', 'bank_transfer'] as CheckoutOptionKind[]
    ).map((kind) => ({
      kind,
      available: false,
      provider: null,
      presentation: 'in_app' as const,
      settlementHint: '—',
      missing: 'País sancionado: no se opera.'
    }));
    return { country, options: blocked };
  }

  return {
    country,
    options: [cryptoWallet(), virtualWallet(country), debitCard(), bankTransfer(country)]
  };
}

/** Coverage across the countries the platform means to serve. */
export function checkoutCoverageMatrix(
  countries = ['AR', 'BR', 'MX', 'CO', 'US', 'ES', 'GB']
): CountryCheckoutCoverage[] {
  return countries.map((country) => checkoutCoverageForCountry(country));
}
