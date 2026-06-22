import { checkoutBaseUrl } from './paymentConfig';

/** dLocal Go (SMB) uses api.dlocalgo.com + checkout.dlocalgo.com, not enterprise dlocal.com. */
export function isDLocalGoMode(): boolean {
  return Boolean(
    process.env.DLOCAL_GO_MERCHANT_ID?.trim() ||
      process.env.DLOCAL_GO_OPEN_LINK_TOKEN?.trim() ||
      process.env.DLOCAL_API_BASE_URL?.includes('dlocalgo.com')
  );
}

export function dlocalGoMerchantId(): string | null {
  return process.env.DLOCAL_GO_MERCHANT_ID?.trim() || null;
}

export function dlocalGoOpenLinkToken(): string | null {
  const explicit = process.env.DLOCAL_GO_OPEN_LINK_TOKEN?.trim();
  if (explicit) {
    return explicit;
  }

  const merchantId = dlocalGoMerchantId();
  if (!merchantId) {
    return null;
  }

  return Buffer.from(`open_link:mid:${merchantId}`, 'utf8').toString('base64');
}

export function buildDLocalGoOpenCheckoutUrl(input?: {
  amountLocal?: number;
  currency?: string;
  externalId?: string;
  successUrl?: string;
  backUrl?: string;
  email?: string | null;
}): string | null {
  const token = dlocalGoOpenLinkToken();
  if (!token) {
    return null;
  }

  const base = (process.env.DLOCAL_CHECKOUT_BASE_URL ?? 'https://checkout.dlocalgo.com').replace(/\/$/, '');
  const url = new URL(`${base}/open-checkout/${token}`);

  if (input?.amountLocal != null && Number.isFinite(input.amountLocal)) {
    url.searchParams.set('amount', input.amountLocal.toFixed(2));
  }
  if (input?.currency) {
    url.searchParams.set('currency', input.currency);
  }
  if (input?.externalId) {
    url.searchParams.set('external_id', input.externalId);
    url.searchParams.set('order_id', input.externalId);
  }
  if (input?.successUrl) {
    url.searchParams.set('success_url', input.successUrl);
  }
  if (input?.backUrl) {
    url.searchParams.set('back_url', input.backUrl);
  }
  if (input?.email) {
    url.searchParams.set('email', input.email);
  }

  return url.toString();
}

export function dlocalGoApiBase(): string {
  if (isDLocalGoMode()) {
    return (process.env.DLOCAL_API_BASE_URL ?? 'https://api.dlocalgo.com').replace(/\/$/, '');
  }
  return (process.env.DLOCAL_API_BASE_URL ?? 'https://api.dlocal.com').replace(/\/$/, '');
}

export function dlocalGoNotificationUrl(): string {
  return `${checkoutBaseUrl()}/api/webhooks/dlocal`;
}
