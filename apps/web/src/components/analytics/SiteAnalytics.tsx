import Script from 'next/script';
import { Suspense } from 'react';
import { headers, cookies } from 'next/headers';
import {
  getGaMeasurementId,
  getPlausibleDomain,
  getPlausibleScriptSrc,
  isAnalyticsEnabled,
  isGaEnabled,
  isPlausibleEnabled
} from '../../lib/analytics/analyticsConfig';
import { GaPageView } from './GaPageView';

export function SiteAnalytics() {
  if (!isAnalyticsEnabled()) {
    return null;
  }

  const gaId = getGaMeasurementId();
  const plausibleDomain = getPlausibleDomain();
  const plausibleSrc = getPlausibleScriptSrc();
  
  const nonceList = headers().get('x-nonce');
  const nonce = nonceList ? nonceList : undefined;

  // Read consent cookie server-side to avoid GA loading before consent is checked
  const consentCookie = cookies().get('sanova.cookie-consent');
  const gaConsented = consentCookie?.value === 'accepted';

  return (
    <>
      {isGaEnabled() ? (
        <>
          {/* GA4 Consent Mode v2 — default denied, updated on user accept */}
          <Script id="sanova-ga4-consent" strategy="afterInteractive" nonce={nonce}>
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('consent', 'default', {
                analytics_storage: '${gaConsented ? 'granted' : 'denied'}',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
              gtag('js', new Date());
              gtag('config', '${gaId}', { anonymize_ip: true, send_page_view: ${gaConsented} });
            `}
          </Script>
          {gaConsented && (
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
              nonce={nonce}
            />
          )}
          <Suspense fallback={null}>
            <GaPageView />
          </Suspense>
        </>
      ) : null}
      {isPlausibleEnabled() ? (
        <Script
          defer
          data-domain={plausibleDomain}
          src={plausibleSrc}
          strategy="afterInteractive"
          nonce={nonce}
        />
      ) : null}
    </>
  );
}
