export type MobileWalletTarget = 'coinbase' | 'metamask';

export const MOBILE_DIRECT_WALLET_CONNECT_ID = 'walletConnectDirect';

function buildWalletConnectDeepLink(wallet: MobileWalletTarget, wcUri: string): string {
  const encoded = encodeURIComponent(wcUri);

  if (wallet === 'coinbase') {
    return `cbwallet://wc?uri=${encoded}`;
  }

  return `metamask://wc?uri=${encoded}`;
}

/** Opens a native wallet app without unloading the dapp tab (keeps WC pairing alive). */
function openNativeAppDeepLink(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function openMobileWalletWcDeepLink(wallet: MobileWalletTarget, wcUri: string): void {
  if (typeof window === 'undefined' || !wcUri) {
    return;
  }

  openNativeAppDeepLink(buildWalletConnectDeepLink(wallet, wcUri));
}
