const GOOGLE_AUTH_IOS =
  'https://apps.apple.com/app/google-authenticator/id388497605';
const GOOGLE_AUTH_ANDROID =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2';

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Android/i.test(navigator.userAgent);
}

export function googleAuthenticatorStoreUrl(): string {
  if (isIosDevice()) {
    return GOOGLE_AUTH_IOS;
  }
  if (isAndroidDevice()) {
    return GOOGLE_AUTH_ANDROID;
  }
  return GOOGLE_AUTH_ANDROID;
}

/**
 * Opens Google Authenticator with the otpauth provisioning URI when the app is installed.
 * Falls back to the store listing when the deep link does not stick (best-effort on mobile).
 */
export function provisionGoogleAuthenticator(otpauthUri: string): void {
  if (typeof window === 'undefined' || !otpauthUri.trim()) {
    return;
  }

  const storeUrl = googleAuthenticatorStoreUrl();
  let openedApp = false;

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      openedApp = true;
    }
  };

  document.addEventListener('visibilitychange', onVisibility, { once: true });

  if (isAndroidDevice()) {
    const path = otpauthUri.replace(/^otpauth:\/\//, '');
    const intent = `intent://${path}#Intent;scheme=otpauth;package=com.google.android.apps.authenticator2;S.browser_fallback_url=${encodeURIComponent(storeUrl)};end`;
    window.location.href = intent;
  } else {
    window.location.href = otpauthUri;
  }

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibility);
    if (!openedApp && document.visibilityState === 'visible') {
      window.open(storeUrl, '_blank', 'noopener,noreferrer');
    }
  }, 1800);
}
