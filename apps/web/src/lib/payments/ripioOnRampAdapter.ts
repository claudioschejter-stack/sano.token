import { randomUUID } from 'node:crypto';
import { checkoutBaseUrl } from './paymentConfig';
import { getStablecoinNetwork } from './stablecoinNetworks';
import {
  formatRipioFiatInstructions,
  ripioApi,
  ripioChainForNetwork,
  ripioConfigured,
  ripioPaymentMethodType,
  ripioSandbox,
  resolveRipioFiatAmount,
  simulateRipioOnRampDeposit
} from './ripioClient';
import { resolveRipioCustomerId } from './ripioCustomerService';

type RipioCheckoutInput = {
  depositId: string;
  amountUsd: number;
  /** When set (e.g. Macro Monto in ARS), quote this exact peso amount instead of FX(USD). */
  fiatAmountArs?: number | null;
  stablecoinNetwork?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  walletAddress?: string | null;
  redirectPath?: string | null;
  paymentOptionRail?: string | null;
  /**
   * After creating the on-ramp order in sandbox, call simulateDeposit so the
   * fiat leg completes without a real bank transfer (Macro→Ripio CVU).
   */
  autoSimulateSandboxDeposit?: boolean;
};

type RipioCheckoutResult = {
  provider: string;
  providerPaymentId?: string;
  providerCheckoutUrl?: string;
  metadata?: Record<string, unknown>;
};

type RipioQuoteResponse = {
  quoteId?: string;
  fromCurrency?: string;
  toCurrency?: string;
  fromAmount?: string;
  toAmount?: string;
  finalToAmount?: string;
  rate?: string;
};

type RipioOnRampOrderResponse = {
  transaction?: {
    transactionId?: string;
    status?: string;
    externalRef?: string;
  };
  fiatPaymentInstructions?: Record<string, unknown>;
};

function buildRipioReturnUrl(input: RipioCheckoutInput): string {
  const base = checkoutBaseUrl();
  if (input.redirectPath?.trim()) {
    const path = input.redirectPath.trim();
    const withPending = path.includes('status=')
      ? path.replace('status=success', 'status=pending')
      : `${path}${path.includes('?') ? '&' : '?'}status=pending`;
    const withProvider = withPending.includes('provider=')
      ? withPending
      : `${withPending}${withPending.includes('?') ? '&' : '?'}provider=ripio`;
    return `${base}${withProvider}`;
  }

  return `${base}/marketplace/carrito?mode=deposit&deposit=${input.depositId}&status=pending&provider=ripio`;
}

export async function createRipioOnRampCheckout(input: RipioCheckoutInput): Promise<RipioCheckoutResult> {
  if (!ripioConfigured()) {
    return { provider: 'ripio', metadata: { configured: false } };
  }

  if (!input.userEmail?.trim() || !input.userId?.trim()) {
    return { provider: 'ripio', metadata: { configured: true, error: 'RIPIO_USER_REQUIRED' } };
  }

  const network = getStablecoinNetwork('BASE');
  const depositAddress = network.treasuryAddress ?? input.walletAddress?.trim();
  if (!depositAddress) {
    return { provider: 'ripio', metadata: { configured: true, error: 'TREASURY_NOT_CONFIGURED' } };
  }

  try {
    const customerId = await resolveRipioCustomerId({
      userId: input.userId,
      email: input.userEmail.trim()
    });

    const { chain, currency } = ripioChainForNetwork(network.id);
    const fiat = resolveRipioFiatAmount(input.amountUsd, { exactArs: input.fiatAmountArs });
    const paymentMethodType = ripioPaymentMethodType(input.paymentOptionRail);

    const quote = await ripioApi<RipioQuoteResponse>('/api/v1/quotes/', {
      method: 'POST',
      body: {
        customerId,
        fromCurrency: fiat.currency,
        toCurrency: currency,
        fromAmount: fiat.amount,
        chain,
        paymentMethodType
      }
    });

    if (!quote.quoteId) {
      return { provider: 'ripio', metadata: { configured: true, error: 'RIPIO_QUOTE_FAILED' } };
    }

    const externalRef = randomUUID();
    const order = await ripioApi<RipioOnRampOrderResponse>('/api/v1/onramp/', {
      method: 'POST',
      body: {
        customerId,
        quoteId: quote.quoteId,
        depositAddress,
        externalRef
      }
    });

    const instructions = order.fiatPaymentInstructions ?? {};
    const redirect = buildRipioReturnUrl(input);

    let sandboxDepositSimulated: boolean | undefined;
    let sandboxDepositError: string | undefined;
    if (input.autoSimulateSandboxDeposit && ripioSandbox()) {
      const aliasOrCvu =
        (typeof instructions.cvu === 'string' && instructions.cvu.trim()) ||
        (typeof instructions.alias === 'string' && instructions.alias.trim()) ||
        '';
      if (aliasOrCvu) {
        try {
          await simulateRipioOnRampDeposit({
            amount: Number(fiat.amount),
            aliasOrCvu,
            paymentMethodType
          });
          sandboxDepositSimulated = true;
        } catch (error) {
          sandboxDepositSimulated = false;
          sandboxDepositError = error instanceof Error ? error.message : 'RIPIO_SIMULATE_FAILED';
        }
      } else {
        sandboxDepositSimulated = false;
        sandboxDepositError = 'RIPIO_SIMULATE_MISSING_CVU';
      }
    }

    return {
      provider: 'ripio',
      providerPaymentId: order.transaction?.transactionId ?? quote.quoteId,
      providerCheckoutUrl: redirect,
      metadata: {
        configured: true,
        mode: 'ripio_on_ramp',
        sandbox: ripioSandbox() || chain.includes('SEPOLIA') || currency === 'RTEST',
        network: network.id,
        chain,
        targetCurrency: currency,
        fiatCurrency: fiat.currency,
        fiatAmount: fiat.amount,
        fiatAmountSource:
          typeof input.fiatAmountArs === 'number' && input.fiatAmountArs > 0 ? 'exact_ars' : 'fx_usd',
        quotedToAmount: quote.finalToAmount ?? quote.toAmount ?? null,
        quoteRate: quote.rate ?? null,
        paymentMethodType,
        ripioCustomerId: customerId,
        ripioExternalRef: externalRef,
        fiatPaymentInstructions: instructions,
        instructions: formatRipioFiatInstructions(instructions),
        transactionId: order.transaction?.transactionId ?? null,
        transactionStatus: order.transaction?.status ?? null,
        ...(sandboxDepositSimulated !== undefined ? { sandboxDepositSimulated } : {}),
        ...(sandboxDepositError ? { sandboxDepositError } : {})
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RIPIO_UNKNOWN_ERROR';
    return {
      provider: 'ripio',
      metadata: {
        configured: true,
        error: message
      }
    };
  }
}
