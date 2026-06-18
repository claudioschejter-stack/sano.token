import { createRemoteJWKSet, jwtVerify } from 'jose';
import { privyAppId, privyJwksUrl } from './config';

export type VerifiedPrivyAccessToken = {
  userId: string;
  sessionId?: string;
};

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getPrivyJwks() {
  const url = privyJwksUrl();
  if (!url) {
    throw new Error('PRIVY_NOT_CONFIGURED');
  }

  remoteJwks ??= createRemoteJWKSet(new URL(url));
  return remoteJwks;
}

export async function verifyPrivyAccessToken(accessToken: string): Promise<VerifiedPrivyAccessToken> {
  const appId = privyAppId();
  if (!appId) {
    throw new Error('PRIVY_NOT_CONFIGURED');
  }

  const token = accessToken.trim().replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('PRIVY_TOKEN_REQUIRED');
  }

  const { payload } = await jwtVerify(token, getPrivyJwks(), {
    issuer: 'privy.io',
    audience: appId
  });

  const userId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!userId) {
    throw new Error('PRIVY_TOKEN_INVALID');
  }

  return {
    userId,
    sessionId: typeof payload.sid === 'string' ? payload.sid : undefined
  };
}
