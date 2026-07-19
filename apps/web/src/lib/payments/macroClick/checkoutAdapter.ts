import { buildMacroClickCheckoutForm } from './checkoutFormBuilder';
import { encodeMacroClickCommerceRef } from './commerceRef';
import { isMacroClickConfigured } from './config';
import { formatMacroClickAmountCents } from './cryptoService';

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'https://www.sanovacapital.com'
  );
}

export type MacroClickOnRampResult = {
  provider: 'macro_click';
  providerPaymentId: string;
  providerCheckoutUrl: string | null;
  metadata: Record<string, unknown>;
};

/**
 * Build hosted checkout (Botón de Integración) for token purchase / deposit.
 * Frontend posts the returned formFields to Macro; settlement is treasury-first via webhook.
 */
export function createMacroClickHostedCheckout(input: {
  referenceId: string;
  referenceKind: 'deposit' | 'cart';
  amount: number;
  currency?: 'ARS' | 'USD';
  label: string;
  userId?: string | null;
  userEmail?: string | null;
  clientIp: string;
  redirectPath?: string | null;
  fxArsPerUsd?: number;
}): MacroClickOnRampResult {
  if (!isMacroClickConfigured()) {
    return {
      provider: 'macro_click',
      providerPaymentId: input.referenceId,
      providerCheckoutUrl: null,
      metadata: { configured: false }
    };
  }

  const currency = input.currency ?? 'ARS';
  const fx = input.fxArsPerUsd ?? Number(process.env.MACRO_CLICK_FX_ARS ?? process.env.RIPIO_FX_ARS ?? '1050');
  const localAmount =
    currency === 'USD' ? input.amount : Number.isFinite(fx) && fx > 0 ? input.amount * fx : input.amount;

  const commerceTransactionId = encodeMacroClickCommerceRef(
    input.referenceKind === 'deposit'
      ? { kind: 'deposit', depositId: input.referenceId }
      : { kind: 'cart', batchId: input.referenceId }
  );

  const successPath = input.redirectPath ?? '/dashboard/portfolio?status=success';
  const formFields = buildMacroClickCheckoutForm({
    commerceTransactionId,
    amount: localAmount,
    products: [{ name: input.label, amountCents: Number(formatMacroClickAmountCents(localAmount)) }],
    callbackSuccess: `${siteUrl()}${successPath.startsWith('/') ? successPath : `/${successPath}`}`,
    callbackCancel: `${siteUrl()}/marketplace/carrito?status=cancel`,
    clientIp: input.clientIp,
    userId: input.userId,
    additionalInfo: {
      referenceId: input.referenceId,
      referenceKind: input.referenceKind,
      amountUsd: input.amount,
      currency,
      localAmount,
      userEmail: input.userEmail ?? null
    },
    clientName: input.userEmail ?? null
  });

  return {
    provider: 'macro_click',
    providerPaymentId: commerceTransactionId,
    // Hosted checkout is a browser POST (not a GET URL). Frontend uses MacroClickCheckoutForm / MacroClickPayButton.
    providerCheckoutUrl: null,
    metadata: {
      configured: true,
      awaitingTreasuryUsdc: true,
      settlementPolicy: 'treasury_first',
      currency,
      localAmount,
      amountUsd: input.amount,
      formFields,
      commerceTransactionId,
      useMacroClickForm: true
    }
  };
}
