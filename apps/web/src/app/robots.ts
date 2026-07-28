import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/seo/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    // Search engines and AI/GEO crawlers (GPTBot, ClaudeBot, PerplexityBot,
    // Google-Extended, bingbot, etc.) are intentionally allowed here — we
    // want maximum visibility across Google, Bing/Copilot, and AI assistants.
    // Only private/authenticated app routes stay disallowed.
    //
    // /acceso is NOT disallowed: Google cannot see a noindex tag on URLs
    // blocked by robots.txt, and reports "Bloqueada por robots.txt". Auth
    // pages stay out of the index via meta robots noindex (acceso layout).
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/blog', '/faq', '/contacto', '/nosotros', '/privacidad', '/terminos'],
        disallow: [
          '/dashboard/',
          '/api/',
          '/marketplace/',
          '/mercado-secundario/',
          '/kyc',
          '/_next/'
        ]
      }
    ],
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/video-sitemap.xml`],
    host: siteUrl
  };
}
