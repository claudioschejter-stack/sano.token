import type { SystemRole } from './roles';

type OAuthExchangeResponse = {
  accessToken: string;
  role: SystemRole;
  roles: SystemRole[];
};

export async function exchangeOAuthSession(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
  providerAccountId: string;
}): Promise<OAuthExchangeResponse> {
  const internalSecret = process.env.AUTH_INTERNAL_SECRET;

  if (!internalSecret) {
    throw new Error('AUTH_INTERNAL_SECRET is not configured.');
  }

  const baseUrl =
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000';

  const response = await fetch(`${baseUrl}/api/internal/auth/oauth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Internal-Secret': internalSecret
    },
    body: JSON.stringify(input),
    cache: 'no-store'
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'OAuth exchange failed.');
  }

  return response.json() as Promise<OAuthExchangeResponse>;
}
