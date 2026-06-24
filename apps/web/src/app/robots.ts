import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/seo/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
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
      },
      // Block AI training crawlers — remove if you want ChatGPT / Perplexity visibility
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
