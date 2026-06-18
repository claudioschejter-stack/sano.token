export type MobileWalletTarget = 'coinbase' | 'metamask';

export { MOBILE_DIRECT_WALLET_CONNECT_ID } from './walletConnectRegistry';

function buildWalletConnectDeepLink(wallet: MobileWalletTarget, wcUri: string): string {
  const encoded = encodeURIComponent(wcUri);

  if (wallet === 'coinbase') {
    return `cbwallet://wc?uri=${encoded}`;
  }

  return `metamask://wc?uri=${encoded}`;
}

/** Match Reown AppKit: window.open keeps the dapp tab alive on mobile browsers. */
function openNativeAppDeepLink(url: string): void {
  window.open(url, '_blank', 'noreferrer noopener');
}

export function openMobileWalletWcDeepLink(wallet: MobileWalletTarget, wcUri: string): void {
  if (typeof window === 'undefined' || !wcUri) {
    return;
  }

  openNativeAppDeepLink(buildWalletConnectDeepLink(wallet, wcUri));
}
