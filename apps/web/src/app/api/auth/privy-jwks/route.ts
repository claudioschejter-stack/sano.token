/**
 * JWKS (JSON Web Key Set) endpoint for Privy Custom JWT Auth.
 *
 * Privy calls this URL to verify the JWTs our server issues via /api/auth/privy-token.
 * Configure in: Privy Dashboard → User Management → Authentication → JWT-based auth
 *   → JWKS URL: https://sanovacapital.com/api/auth/privy-jwks
 *   → User ID claim: sub
 *
 * The public key is embedded directly here (it's not a secret).
 * Rotate by regenerating the RSA pair, updating PRIVY_JWT_PRIVATE_KEY in Vercel,
 * and deploying a new version of this file with the new public key JWK.
 */

import { NextResponse } from 'next/server';

const JWKS = {
  keys: [
    {
      kty: 'RSA',
      n: 'z6saKJBgTVuvLrTNHm-4xXE0U5I-dT3OG1gbm-goFpzkrX9yb2er70Q4DbLPNdi7pE-g7si5NS9UAL6Peca8NBP_kW8EYezZPuaXJjZG0UlTSIP4NWO7nhyGF5hD-FRkFsAHMXGITdUspAMAzTDZ5DPd5hKGw3JoplzCzS0XPTi3vkGugM0gbdQmruprJLpXMQWZmofP-L6KNt3eYlo93uIcy1IaDl9o_uso0XqjaPnF4K1P9iuY8oOB-I6N3iLHJB3zNyNRkevcYyCPVPAeD1-CNalpNtP-P-PCP-6gT8eo__Z-Cd1d2M-2EjetQcSsAGKQmsoafz6w_9yrqBif8w',
      e: 'AQAB',
      kid: 'sanova-rwa-v1',
      use: 'sig',
      alg: 'RS256'
    }
  ]
} as const;

export async function GET() {
  return NextResponse.json(JWKS, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
