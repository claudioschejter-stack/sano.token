export const COLLECTION_WALLET_PATH = '/dashboard/wallet-cobro';

export function collectionWalletHref(options?: { returnTo?: string; preference?: 'USDC' }) {
  const params = new URLSearchParams();
  if (options?.returnTo) {
    params.set('returnTo', options.returnTo);
  }
  if (options?.preference) {
    params.set('preference', options.preference);
  }
  const query = params.toString();
  return query ? `${COLLECTION_WALLET_PATH}?${query}` : COLLECTION_WALLET_PATH;
}
