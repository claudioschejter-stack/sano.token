import type { PaymentMethod } from '@sanova/database';
import { paymentGatewayConfigured } from './paymentConfig';
import { enabledStablecoinNetworks, getStablecoinNetwork, type StablecoinNetworkId } from './stablecoinNetworks';

export type PaymentRouteDirection = 'FIAT_TO_BALANCE' | 'STABLECOIN_TO_BALANCE' | 'FIAT_TO_STABLECOIN' | 'STABLECOIN_TO_FIAT';

export type CheapestPaymentRouteInput = {
  amountUsd: number;
  country?: string | null;
  currency?: string | null;
  direction?: PaymentRouteDirection;
  userHasStablecoin?: boolean;
  preferredNetwork?: string | null;
};

export type PaymentRouteQuote = {
  method: PaymentMethod;
  provider: string;
  label: string;
  estimatedFeeUsd: number;
  estimatedFeeBps: number;
  stablecoinNetwork?: StablecoinNetworkId;
  reason: string;
  configured: boolean;
};

const LOCAL_RAILS: Record<string, { label: string; feeBps: number; provider: string }> = {
  MX: { label: 'SPEI Mexico', feeBps: 35, provider: 'spei' },
  BR: { label: 'Pix Brasil', feeBps: 25, provider: 'pix' },
  IN: { label: 'UPI India', feeBps: 20, provider: 'upi' },
  US: { label: 'ACH USA', feeBps: 60, provider: 'ach' },
  AR: { label: 'Mercado Pago Argentina', feeBps: 280, provider: 'mercado_pago' },
  EU: { label: 'SEPA Europa', feeBps: 45, provider: 'sepa' }
};

export function quoteCheapestPaymentRoutes(input: CheapestPaymentRouteInput): PaymentRouteQuote[] {
  const amountUsd = Number.isFinite(input.amountUsd) && input.amountUsd > 0 ? input.amountUsd : 0;
  const country = normalizeCountry(input.country);
  const direction = input.direction ?? (input.userHasStablecoin ? 'STABLECOIN_TO_BALANCE' : 'FIAT_TO_BALANCE');
  const routes: PaymentRouteQuote[] = [];

  if (direction === 'STABLECOIN_TO_BALANCE' || input.userHasStablecoin) {
    for (const network of enabledStablecoinNetworks()) {
      routes.push({
        method: 'USDC_ONCHAIN',
        provider: `${network.id.toLowerCase()}_stablecoin`,
        label: network.label,
        estimatedFeeUsd: network.cheapestRank === 1 ? 0.03 : network.cheapestRank === 2 ? 0.05 : network.cheapestRank === 3 ? 0.01 : 0.75,
        estimatedFeeBps: feeBps(network.cheapestRank === 1 ? 0.03 : network.cheapestRank === 2 ? 0.05 : network.cheapestRank === 3 ? 0.01 : 0.75, amountUsd),
        stablecoinNetwork: network.id,
        reason: network.id === 'BASE' ? 'Default mas barato: USDC en Base' : `Stablecoin directa en ${network.label}`,
        configured: Boolean(network.tokenAddress && network.treasuryAddress)
      });
    }
  }

  const localRail = LOCAL_RAILS[country];
  if (localRail && direction !== 'STABLECOIN_TO_FIAT') {
    routes.push({
      method: country === 'AR' ? 'MERCADO_PAGO' : 'LOCAL_RAIL',
      provider: localRail.provider,
      label: localRail.label,
      estimatedFeeUsd: (amountUsd * localRail.feeBps) / 10_000,
      estimatedFeeBps: localRail.feeBps,
      reason: 'Rail bancario/local suele ser mas barato que tarjeta',
      configured: country === 'AR' ? paymentGatewayConfigured('MERCADO_PAGO') : paymentGatewayConfigured('LOCAL_RAIL')
    });
  }

  if (direction === 'FIAT_TO_STABLECOIN' || direction === 'STABLECOIN_TO_FIAT' || direction === 'FIAT_TO_BALANCE') {
    routes.push(
      route('BRIDGE', 'bridge', 'Bridge', amountUsd, 80, 'Mas barato para on/off-ramp empresarial con volumen'),
      route('TRANSAK', 'transak', 'Transak', amountUsd, 180, 'On-ramp global rapido'),
      route('RAMP', 'ramp', 'Ramp Network', amountUsd, 200, 'Fallback global fiat-cripto')
    );
  }

  routes.push(
    route('STRIPE', 'stripe', 'Stripe', amountUsd, 290, 'Tarjeta/wallet global, mas caro que rails locales'),
    route('MERCADO_PAGO', 'mercado_pago', 'Mercado Pago', amountUsd, 320, 'Fallback LatAm'),
    route('COINBASE', 'coinbase', 'Coinbase Commerce', amountUsd, 100, 'Cripto checkout global')
  );

  const preferredNetwork = input.preferredNetwork ? getStablecoinNetwork(input.preferredNetwork).id : null;
  return routes
    .filter((routeItem) => routeItem.configured)
    .sort((a, b) => {
      if (preferredNetwork && a.stablecoinNetwork === preferredNetwork) return -1;
      if (preferredNetwork && b.stablecoinNetwork === preferredNetwork) return 1;
      return a.estimatedFeeUsd - b.estimatedFeeUsd;
    });
}

export function chooseCheapestPaymentRoute(input: CheapestPaymentRouteInput): PaymentRouteQuote {
  const routes = quoteCheapestPaymentRoutes(input);
  if (!routes.length) {
    const fallbackNetwork = getStablecoinNetwork('BASE');
    return {
      method: 'USDC_ONCHAIN',
      provider: 'base_stablecoin',
      label: fallbackNetwork.label,
      estimatedFeeUsd: 0.03,
      estimatedFeeBps: feeBps(0.03, input.amountUsd),
      stablecoinNetwork: 'BASE',
      reason: 'Fallback seguro: stablecoin directa en Base',
      configured: false
    };
  }
  return routes[0];
}

function route(method: PaymentMethod, provider: string, label: string, amountUsd: number, bps: number, reason: string): PaymentRouteQuote {
  return {
    method,
    provider,
    label,
    estimatedFeeUsd: (amountUsd * bps) / 10_000,
    estimatedFeeBps: bps,
    reason,
    configured: paymentGatewayConfigured(method)
  };
}

function feeBps(feeUsd: number, amountUsd: number) {
  return amountUsd > 0 ? Math.round((feeUsd / amountUsd) * 10_000) : 0;
}

function normalizeCountry(country?: string | null) {
  const value = country?.trim().toUpperCase();
  if (!value) return 'US';
  if (['ES', 'FR', 'DE', 'IT', 'NL', 'PT', 'IE', 'BE', 'AT'].includes(value)) return 'EU';
  return value;
}
