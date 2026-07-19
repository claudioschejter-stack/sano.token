import { createMacroClickPaymentLink, createMacroClickQr, createMacroClickQrMultiDue } from './apiClient';
import { encodeMacroClickCommerceRef } from './commerceRef';
import { formatMacroClickAmountCents } from './cryptoService';
import { isMacroClickConfigured } from './config';

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'https://www.sanovacapital.com'
  );
}

export type CreateMacroRentChargeInput = {
  projectId: string;
  periodKey: string;
  amount: number;
  currency: 'ARS' | 'USD';
  tenantKey?: string;
  tenantEmail?: string | null;
  description?: string;
  mode?: 'link' | 'qr' | 'qr_multi';
  /** Extra due rows for mora (qr_multi only). */
  dues?: Array<{ dueDate: string; amount: number }>;
};

/**
 * Create a Macro payment link/QR for a property rent charge.
 * On webhook REALIZADA, rentSettlement credits the project operating account and distributes to holders.
 */
export async function createMacroRentCharge(input: CreateMacroRentChargeInput) {
  if (!isMacroClickConfigured()) {
    throw new Error('MACRO_CLICK_NOT_CONFIGURED');
  }

  const commerceTransactionId = encodeMacroClickCommerceRef({
    kind: 'rent',
    projectId: input.projectId,
    periodKey: input.periodKey,
    currency: input.currency,
    tenantKey: input.tenantKey
  });

  const notificationUrl = `${siteUrl()}/api/webhooks/macro-click`;
  const description =
    input.description?.trim() ||
    `Alquiler ${input.periodKey} — proyecto ${input.projectId} (${input.currency})`;
  const amountCents = Number(formatMacroClickAmountCents(input.amount));
  const mode = input.mode ?? 'link';

  if (mode === 'qr_multi' && input.dues?.length) {
    const created = await createMacroClickQrMultiDue({
      commerceTransactionId,
      description,
      notificationUrl,
      dues: input.dues.map((d) => ({
        dueDate: d.dueDate,
        amountCents: Number(formatMacroClickAmountCents(d.amount))
      }))
    });
    return {
      commerceTransactionId,
      mode,
      notificationUrl,
      data: created.data ?? created
    };
  }

  if (mode === 'qr') {
    const created = await createMacroClickQr({
      amountCents,
      commerceTransactionId,
      description,
      notificationUrl
    });
    return {
      commerceTransactionId,
      mode,
      notificationUrl,
      data: created.data ?? created
    };
  }

  const created = await createMacroClickPaymentLink({
    amountCents,
    commerceTransactionId,
    description,
    notificationUrl,
    successUrl: `${siteUrl()}/dashboard/portfolio?rentPaid=1`,
    cancelUrl: `${siteUrl()}/dashboard/portfolio?rentPaid=0`,
    currency: input.currency,
    additionalInfo: {
      projectId: input.projectId,
      periodKey: input.periodKey,
      tenantKey: input.tenantKey ?? null,
      tenantEmail: input.tenantEmail ?? null,
      currency: input.currency
    }
  });

  const data = (created.data ?? created) as { url?: string; link?: string };
  return {
    commerceTransactionId,
    mode: 'link' as const,
    notificationUrl,
    paymentUrl: data.url ?? data.link ?? null,
    data: created.data ?? created
  };
}
