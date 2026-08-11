import { getStablecoinNetwork } from './stablecoinNetworks';
import { ripioApi, ripioChainForNetwork, ripioConfigured, ripioPaymentMethodType } from './ripioClient';
import { resolveRipioCustomerId } from './ripioCustomerService';
import type { QuoteFetcher } from './effectiveArsRate';
import type { RipioProbeQuote } from './arsChargeForTargetUsdc';

/**
 * Preguntarle a Ripio cuántos USDC deja una cantidad de pesos.
 *
 * Es la misma llamada que ya hace el on-ramp antes de crear la orden, pero acá se
 * usa sólo para conocer el precio: con `finalToAmount` se despeja cuántos pesos hay
 * que cobrar para que a la treasury entren los USDC de la compra.
 *
 * `finalToAmount` es el número que importa, no `toAmount`: la comisión de Ripio
 * sale del medio, así que cotizar contra el bruto deja la diferencia descubierta.
 */

type RipioQuoteResponse = {
  quoteId?: string;
  fromAmount?: string;
  toAmount?: string;
  finalToAmount?: string;
  rate?: string;
};

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * @param input.userId y `userEmail` porque Ripio cotiza contra un cliente suyo.
 * @param input.paymentOptionRail El medio cambia la comisión, así que cotizar por
 *   el rail equivocado da un precio que no es el que se va a pagar.
 */
export function createRipioQuoteFetcher(input: {
  userId: string;
  userEmail?: string | null;
  paymentOptionRail?: string | null;
}): QuoteFetcher {
  return async (probeArs: number): Promise<RipioProbeQuote | null> => {
    const email = input.userEmail?.trim();
    if (!ripioConfigured() || !email) {
      return null;
    }

    const network = getStablecoinNetwork('BASE');
    const { chain, currency } = ripioChainForNetwork(network.id);
    const customerId = await resolveRipioCustomerId({ userId: input.userId, email });

    const quote = await ripioApi<RipioQuoteResponse>('/api/v1/quotes/', {
      method: 'POST',
      body: {
        customerId,
        fromCurrency: 'ARS',
        toCurrency: currency,
        fromAmount: probeArs.toFixed(2),
        chain,
        paymentMethodType: ripioPaymentMethodType(input.paymentOptionRail)
      }
    });

    const fromAmountArs = parseAmount(quote.fromAmount) ?? probeArs;
    const finalToAmountUsdc = parseAmount(quote.finalToAmount) ?? parseAmount(quote.toAmount);

    if (!finalToAmountUsdc) {
      return null;
    }

    return { fromAmountArs, finalToAmountUsdc };
  };
}
