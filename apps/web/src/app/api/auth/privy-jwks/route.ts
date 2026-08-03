/**
 * JWKS (JSON Web Key Set) endpoint for Privy Custom JWT Auth.
 *
 * Privy calls this URL to verify the JWTs our server issues via /api/auth/privy-token.
 * Configure in: Privy Dashboard → User Management → Authentication → JWT-based auth
 *
 * IMPORTANT — Cloudflare bot challenge currently blocks:
 *   https://www.sanovacapital.com/api/auth/privy-jwks  (403 "Just a moment…")
 * Prefer:
 *   JWKS URL: https://sano-token-web.vercel.app/api/auth/privy-jwks
 *
 * User ID claim: sub
 *
 * The public key is embedded directly here (it's not a secret).
 * Rotate by regenerating the RSA pair, updating PRIVY_JWT_PRIVATE_KEY in Vercel,
 * and deploying a new version of this file with the new public key JWK.
 */

import { NextResponse } from 'next/server';
import { PRIVY_CUSTOM_AUTH_JWT_KID } from '../../../../lib/privy/privyCustomAuthJwt';

const JWKS = {
  keys: [
    {
      kty: 'RSA',
      n: 'quEgdW4-WiT1dhqVHUI_g0UzqewEf4Fo4Lbfvq9eg-vvZ_B06tKBjIRymbFTuixRdT84EgRzDFm6qtl-dw1-d1sBAhilYyrq0T1xTVCRAl2P82R8-3IDlQsCeTmpQKiopLkjPoP2_T2M5LtlSY2CdkYJk9PPbLQbJB5wC1IjWisQMVusWS0lgyZO01L6elkyOfh07ViKpSa5RGJ4fs2wwjFCn3PklljhYAfp1pnsjggwh-W6X4ovPIv_GRaA2HXFOmOCQjR3Ug8yQ1bmpT86Oy0IbM2BD93QIysn0iKCiZHzDlTJovmB1hqb3BMP6_f0SQ9uuoqIFB-UdIV0tnxgMw',
      e: 'AQAB',
      kid: PRIVY_CUSTOM_AUTH_JWT_KID,
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
