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
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'ChatGPT-User', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'Claude-Web', disallow: '/' }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
