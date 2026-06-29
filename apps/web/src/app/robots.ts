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
      // Block all AI training crawlers explicitly
      { userAgent: 'GPTBot', disallow: ['/'] },
      { userAgent: 'ChatGPT-User', disallow: ['/'] },
      { userAgent: 'Google-Extended', disallow: ['/'] },
      { userAgent: 'Applebot-Extended', disallow: ['/'] },
      { userAgent: 'Applebot', disallow: ['/'] },
      { userAgent: 'ClaudeBot', disallow: ['/'] },
      { userAgent: 'Claude-User', disallow: ['/'] },
      { userAgent: 'PerplexityBot', disallow: ['/'] },
      { userAgent: 'bingbot', disallow: ['/'] },
      { userAgent: 'BingPreview', disallow: ['/'] },
      { userAgent: 'DeepSeekBot', disallow: ['/'] },
      { userAgent: 'Bytespider', disallow: ['/'] },
      { userAgent: 'AmazonBot', disallow: ['/'] },
      { userAgent: 'Meta-ExternalAgent', disallow: ['/'] },
      { userAgent: 'FacebookBot', disallow: ['/'] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
