export type MobileWalletTarget = 'coinbase' | 'metamask';

export function openMobileWalletWcDeepLink(wallet: MobileWalletTarget, wcUri: string): void {
  if (typeof window === 'undefined' || !wcUri) {
    return;
  }

  const encoded = encodeURIComponent(wcUri);

  if (wallet === 'coinbase') {
    window.location.assign(`https://wallet.coinbase.com/wsegue?uri=${encoded}`);
    return;
  }

  window.location.assign(`metamask://wc?uri=${encoded}`);
}
