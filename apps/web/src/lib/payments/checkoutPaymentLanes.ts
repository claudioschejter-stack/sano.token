import type { DepositPaymentOption } from './depositPaymentOptions';
import { compareDepositPaymentOptions } from './depositPaymentOptions';
import {
  buildFiatOnRampDisplayOptions,
  buildCheckoutDisplaySections,
  buildFiatOnRampDisplayId,
  FIAT_ON_RAMP_SOURCE_IDS,
  type CheckoutDisplaySections,
  type FiatOnRampDisplayLabels,
  WALLET_CHECKOUT_ORDER
} from './checkoutPaymentDisplay';
import { normalizePaymentCountry } from './paymentCountry';

export type CheckoutPaymentLaneId = 'electronic_wallet' | 'crypto_wallet' | 'card';

const CRYPTO_WALLET_IDS = new Set<string>([...WALLET_CHECKOUT_ORDER, 'walletconnect_usdc']);

/**
 * Los cobradores que cobran con tarjeta. El checkout alojado de Macro entra acá:
 * su API declara nueve marcas de tarjeta habilitadas y ninguna billetera, así que
 * clasificarlo como "billetera electrónica" —donde caía por ser LOCAL_RAIL—
 * escondía el pago con tarjeta en pesos donde nadie lo iba a buscar.
 */
const CARD_BACKEND_IDS = new Set<string>([
  'bridge',
  'privy_on_ramp',
  'macro_click_ars',
  'macro_click_usd'
]);

/**
 * En Argentina cobra Macro. Es una decisión de negocio y no un hecho de precio, así
 * que va como preferencia explícita: meterla como un precio más bajo del real
 * mentiría en la comparación que el inversor ve.
 */
const PREFERRED_CARD_BACKEND_BY_COUNTRY: Record<string, string[]> = {
  AR: ['macro_click_ars']
};

export function pickCardBackend(
  options: DepositPaymentOption[],
  country: string
): DepositPaymentOption | null {
  const configured = options.filter((row) => isCardBackendOption(row) && row.configured);
  if (configured.length === 0) {
    return null;
  }

  for (const preferredId of PREFERRED_CARD_BACKEND_BY_COUNTRY[country] ?? []) {
    const preferred = configured.find((row) => row.id === preferredId);
    if (preferred) {
      return preferred;
    }
  }

  return [...configured].sort(compareDepositPaymentOptions)[0] ?? null;
}

const COUNTRY_LABELS: Record<string, string> = {
  AR: 'Argentina',
  BR: 'Brasil',
  US: 'Estados Unidos',
  EU: 'Unión Europea',
  MX: 'México',
  IN: 'India',
  CN: 'China'
};

export type CheckoutPaymentLaneSummary = {
  id: CheckoutPaymentLaneId;
  available: boolean;
  optionCount: number;
  cheapestTotalUsd: number | null;
  cheapestTotalLocal: number | null;
  displayCurrency: string | null;
};

export type CheckoutPaymentLaneBundle = {
  country: string;
  countryLabel: string;
  optionsByLane: Record<CheckoutPaymentLaneId, DepositPaymentOption[]>;
  cardDisplayOptions: DepositPaymentOption[];
  cheapestCardBackend: DepositPaymentOption | null;
  laneSummaries: CheckoutPaymentLaneSummary[];
  recommendedLaneId: CheckoutPaymentLaneId | null;
  sections: CheckoutDisplaySections;
};

function isCardBackendOption(option: DepositPaymentOption): boolean {
  if (CARD_BACKEND_IDS.has(option.id)) {
    return true;
  }
  if (FIAT_ON_RAMP_SOURCE_IDS.includes(option.id as (typeof FIAT_ON_RAMP_SOURCE_IDS)[number])) {
    return true;
  }
  if (option.method === 'PRIVY_ONRAMP' || option.method === 'BRIDGE') {
    return true;
  }
  return false;
}

export function classifyCheckoutPaymentLane(option: DepositPaymentOption): CheckoutPaymentLaneId {
  if (CRYPTO_WALLET_IDS.has(option.id)) {
    return 'crypto_wallet';
  }

  if (isCardBackendOption(option)) {
    return 'card';
  }

  if (
    option.method === 'MERCADO_PAGO' ||
    option.method === 'RIPIO' ||
    option.method === 'LOCAL_RAIL' ||
    option.provider === 'mercado_pago' ||
    option.provider === 'ripio'
  ) {
    return 'electronic_wallet';
  }

  return 'electronic_wallet';
}

function summarizeLane(
  id: CheckoutPaymentLaneId,
  options: DepositPaymentOption[]
): CheckoutPaymentLaneSummary {
  const configured = options.filter((row) => row.configured);
  const cheapest = configured[0] ?? null;

  return {
    id,
    available: configured.length > 0,
    optionCount: configured.length,
    cheapestTotalUsd: cheapest?.totalUsd ?? null,
    cheapestTotalLocal: cheapest?.totalLocal ?? null,
    displayCurrency: cheapest?.displayCurrency ?? null
  };
}

export function buildCheckoutPaymentLaneBundle(input: {
  options: DepositPaymentOption[];
  country: string;
  fiatOnRampLabels: FiatOnRampDisplayLabels;
}): CheckoutPaymentLaneBundle {
  const normalizedCountry = normalizePaymentCountry(input.country);
  const sections = buildCheckoutDisplaySections(input.options, input.fiatOnRampLabels);

  const visible = input.options.filter(
    (row) => !FIAT_ON_RAMP_SOURCE_IDS.includes(row.id as (typeof FIAT_ON_RAMP_SOURCE_IDS)[number])
  );

  const optionsByLane: Record<CheckoutPaymentLaneId, DepositPaymentOption[]> = {
    electronic_wallet: [],
    crypto_wallet: [],
    card: []
  };

  for (const option of visible) {
    optionsByLane[classifyCheckoutPaymentLane(option)].push(option);
  }

  optionsByLane.crypto_wallet = [...optionsByLane.crypto_wallet].sort(compareDepositPaymentOptions);
  optionsByLane.electronic_wallet = [...optionsByLane.electronic_wallet].sort(compareDepositPaymentOptions);

  const cheapestCardBackend = pickCardBackend(input.options, normalizedCountry);

  const cardDisplayOptions = cheapestCardBackend
    ? buildFiatOnRampDisplayOptions(cheapestCardBackend, input.fiatOnRampLabels).map((row) => ({
        ...row,
        totalUsd: cheapestCardBackend.totalUsd,
        totalLocal:
          row.id === buildFiatOnRampDisplayId('international_transfer')
            ? null
            : cheapestCardBackend.totalLocal,
        displayCurrency:
          row.id === buildFiatOnRampDisplayId('international_transfer')
            ? 'USD'
            : cheapestCardBackend.displayCurrency,
        usesLocalCurrency:
          row.id !== buildFiatOnRampDisplayId('international_transfer') &&
          cheapestCardBackend.usesLocalCurrency,
        feeUsd: cheapestCardBackend.feeUsd,
        configured: true
      }))
    : [];

  optionsByLane.card = cardDisplayOptions;

  const laneSummaries: CheckoutPaymentLaneSummary[] = (
    ['electronic_wallet', 'crypto_wallet', 'card'] as CheckoutPaymentLaneId[]
  ).map((laneId) => summarizeLane(laneId, optionsByLane[laneId]));

  const recommendedLaneId =
    laneSummaries
      .filter((lane) => lane.available)
      .sort((a, b) => {
        const aTotal = a.cheapestTotalUsd ?? Number.POSITIVE_INFINITY;
        const bTotal = b.cheapestTotalUsd ?? Number.POSITIVE_INFINITY;
        return aTotal - bTotal;
      })[0]?.id ?? null;

  return {
    country: normalizedCountry,
    countryLabel: COUNTRY_LABELS[normalizedCountry] ?? normalizedCountry,
    optionsByLane,
    cardDisplayOptions,
    cheapestCardBackend: cheapestCardBackend ?? null,
    laneSummaries,
    recommendedLaneId,
    sections
  };
}

export function defaultOptionIdForLane(
  laneId: CheckoutPaymentLaneId,
  bundle: CheckoutPaymentLaneBundle
): string | null {
  const configured = bundle.optionsByLane[laneId].filter((row) => row.configured);
  return configured[0]?.id ?? null;
}
