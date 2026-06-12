import Script from 'next/script';
import { Suspense } from 'react';
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

  return (
    <>
      {isGaEnabled() ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="sanova-ga4" strategy="afterInteractive">
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
        />
      ) : null}
    </>
  );
}
