import { privyAppId } from './config';

const PRIVY_API = 'https://api.privy.io';

export function privyApiBase(): string {
  return PRIVY_API;
}

export function privyAuthHeader(): string {
  const secret = process.env.PRIVY_APP_SECRET?.trim();
  if (!secret) {
    throw new Error('PRIVY_APP_SECRET_NOT_CONFIGURED');
  }
  const credentials = Buffer.from(`${privyAppId()}:${secret}`).toString('base64');
  return `Basic ${credentials}`;
}

export function privyHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    'privy-app-id': privyAppId(),
    Authorization: privyAuthHeader(),
    'Content-Type': 'application/json',
    ...extra
  };
}
