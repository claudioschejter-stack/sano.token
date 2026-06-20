import { NextResponse } from 'next/server';
import {
  getEnabledOAuthProviders,
  isAppleOAuthConfigured,
  isGoogleOAuthConfigured
} from '../../../../lib/auth/oauthProviders';

export async function GET() {
  return NextResponse.json({
    google: isGoogleOAuthConfigured(),
    apple: isAppleOAuthConfigured(),
    providers: getEnabledOAuthProviders()
  });
}
