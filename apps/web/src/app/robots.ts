import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/seo/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/acceso', '/contacto', '/privacidad', '/terminos'],
        disallow: [
          '/dashboard/',
          '/api/',
          '/marketplace/',
          '/mercado-secundario/',
          '/kyc'
        ]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
