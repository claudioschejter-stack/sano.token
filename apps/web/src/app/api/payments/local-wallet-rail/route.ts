import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { resolveLocalWalletRail } from '../../../../lib/payments/localWalletRail';
import { resolvePaymentCountryForUser } from '../../../../lib/payments/paymentCountry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The one local payment option for this investor's country.
 *
 * Returns a rail, not a list. The checkout used to show every provider the
 * catalogue knew about and ask the investor to choose, which is a question they
 * have no way to answer: they know they use Nubank, not that Nubank speaks Pix.
 * The country answers it instead.
 *
 * `GET /api/payments/local-wallet-rail?country=MX`
 */
export async function GET(request: NextRequest) {
  const hint = new URL(request.url).searchParams.get('country');

  const session = await auth();
  const userId = session?.user?.id;

  /**
   * The account's jurisdiction wins over anything the browser says: it is the
   * one the investor declared and KYC verified.
   */
  const country = userId
    ? await resolvePaymentCountryForUser(userId, hint)
    : (hint?.trim().toUpperCase() ?? 'AR');

  const resolution = resolveLocalWalletRail(country);

  if (resolution.available === false) {
    return NextResponse.json({
      ok: false,
      country: resolution.country,
      reason: resolution.reason,
      /** Present even when unavailable, so the UI can name what is coming. */
      rail: resolution.rail ?? null
    });
  }

  return NextResponse.json({ ok: true, country, rail: resolution.rail });
}
