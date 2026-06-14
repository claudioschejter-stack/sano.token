import { checkoutBaseUrl } from './paymentConfig';

type WiseManualInput = {
  referenceId: string;
  amountUsd: number;
  currency?: string;
  label?: string;
};

type WiseManualResult = {
  provider: string;
  providerPaymentId: string;
  metadata: Record<string, unknown>;
};

function parseWiseDetails(raw: string | undefined, currency: string): Record<string, string> | null {
  if (!raw?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed;
  } catch {
    return {
      currency,
      instructions: raw.trim()
    };
  }
}

export function buildWiseReceiveInstructions(currency: string): Record<string, string> | null {
  const upper = currency.toUpperCase();
  if (upper === 'EUR') {
    return parseWiseDetails(process.env.WISE_RECEIVE_EUR_DETAILS, 'EUR');
  }
  if (upper === 'GBP') {
    return parseWiseDetails(process.env.WISE_RECEIVE_GBP_DETAILS, 'GBP');
  }
  return parseWiseDetails(process.env.WISE_RECEIVE_USD_DETAILS ?? process.env.WISE_RECEIVE_DETAILS, 'USD');
}

export function createWiseManualCheckout(input: WiseManualInput): WiseManualResult {
  const currency = (input.currency ?? 'USD').toUpperCase();
  const receiveDetails = buildWiseReceiveInstructions(currency);
  const accountName = process.env.WISE_BUSINESS_ACCOUNT_NAME?.trim() ?? 'Sanova Global';

  const instructions = receiveDetails
    ? Object.entries(receiveDetails)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
    : 'Configure WISE_RECEIVE_USD_DETAILS (or EUR/GBP) in environment variables with bank transfer instructions.';

  return {
    provider: 'wise',
    providerPaymentId: input.referenceId,
    metadata: {
      configured: Boolean(receiveDetails),
      mode: 'manual_reconciliation',
      provider: 'wise',
      label: input.label ?? 'Wise international transfer',
      reference: input.referenceId,
      amountUsd: input.amountUsd,
      currency,
      accountName,
      receiveDetails,
      instructions,
      instructionSummary: `Transfer ${input.amountUsd.toFixed(2)} USD (or equivalent in ${currency}) via Wise. Reference: ${input.referenceId}`,
      supportEmail: process.env.NEXT_PUBLIC_CONTACT_TO_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? null,
      returnUrl: `${checkoutBaseUrl()}/marketplace/carrito?status=pending`
    }
  };
}
