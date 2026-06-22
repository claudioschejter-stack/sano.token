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

const CARD_BACKEND_IDS = new Set<string>([
  'transak',
  'bridge',
  'coinbase_commerce',
  'privy_on_ramp',
  'ramp',
  'wise'
]);

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
  if (option.method === 'TRANSAK' || option.method === 'BRIDGE') {
    return option.id !== 'coinbase_pay';
  }
  if (option.method === 'COINBASE' && option.provider === 'coinbase') {
    return true;
  }
  return false;
}

export function classifyCheckoutPaymentLane(option: DepositPaymentOption): CheckoutPaymentLaneId {
  if (CRYPTO_WALLET_IDS.has(option.id)) {
    return 'crypto_wallet';
  }

  if (option.method === 'CUSTODIAL_STABLECOIN') {
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
    option.provider === 'ripio' ||
    option.provider === 'dlocal' ||
    option.provider === 'astropay'
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

  const cardBackends = input.options
    .filter((row) => isCardBackendOption(row) && row.configured)
    .sort(compareDepositPaymentOptions);
  const cheapestCardBackend = cardBackends[0] ?? null;

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
