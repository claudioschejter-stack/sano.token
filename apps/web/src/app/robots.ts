import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/seo/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    // Search engines and AI/GEO crawlers (GPTBot, ClaudeBot, PerplexityBot,
    // Google-Extended, bingbot, etc.) are intentionally allowed here — we
    // want maximum visibility across Google, Bing/Copilot, and AI assistants.
    // Only private/authenticated app routes stay disallowed.
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/blog', '/nosotros', '/faq', '/contacto', '/privacidad', '/terminos'],
        disallow: [
          '/dashboard/',
          '/api/',
          '/marketplace/',
          '/mercado-secundario/',
          '/kyc',
          '/acceso',
          '/_next/'
        ]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
