import Script from 'next/script';
import { Suspense } from 'react';
import { headers } from 'next/headers';
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

  return (
    <>
      {isGaEnabled() ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          <Script id="sanova-ga4" strategy="afterInteractive" nonce={nonce}>
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaId}', { anonymize_ip: true, send_page_view: true });
            `}
          </Script>
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
