import { NextResponse } from 'next/server';
import { handleOAuthLogin } from '../../../../../lib/auth/oauthService';

export async function POST(request: Request) {
  const internalSecret = process.env.AUTH_INTERNAL_SECRET;
  const headerSecret = request.headers.get('x-auth-internal-secret');

  if (!internalSecret || headerSecret !== internalSecret) {
    return NextResponse.json({ message: 'Invalid internal auth secret.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      image?: string;
      provider?: string;
      providerAccountId?: string;
    };

    if (!body.email || !body.provider || !body.providerAccountId) {
      return NextResponse.json({ message: 'Invalid OAuth payload.' }, { status: 400 });
    }

    const result = await handleOAuthLogin({
      email: body.email,
      name: body.name,
      image: body.image,
      provider: body.provider,
      providerAccountId: body.providerAccountId
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[oauth] exchange failed:', error);
    return NextResponse.json({ message: 'OAuth exchange failed.' }, { status: 500 });
  }
}
