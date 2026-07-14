export const COLLECTION_WALLET_SECTION_ID = 'conexion-billetera';

export const COLLECTION_WALLET_PATH = '/dashboard/settings/security';

export function collectionWalletHref(options?: { returnTo?: string; preference?: 'USDC' }) {
  const params = new URLSearchParams();
  if (options?.returnTo) {
    params.set('returnTo', options.returnTo);
  }
  if (options?.preference) {
    params.set('preference', options.preference);
  }
  const query = params.toString();
  const base = query ? `${COLLECTION_WALLET_PATH}?${query}` : COLLECTION_WALLET_PATH;
  return `${base}#${COLLECTION_WALLET_SECTION_ID}`;
}
