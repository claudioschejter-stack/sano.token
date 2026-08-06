import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  checkoutCoverageForCountry,
  checkoutCoverageMatrix
} from '../../../../lib/payments/checkoutOptionMatrix';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin: which of the four payment options works in which country, and what is
 * missing for the rest.
 *
 * Answers the question a catalogue of fourteen providers could not: not "how
 * many methods do we support" but "can somebody in Mexico pay from their wallet
 * today, and if not, what has to happen".
 *
 * `GET /api/admin/payment-coverage?countries=AR,BR,MX`
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requested = new URL(request.url).searchParams.get('countries')?.trim();
  const countries = requested
    ? requested.split(',').map((row) => row.trim().toUpperCase()).filter(Boolean)
    : undefined;

  const matrix = countries?.length
    ? countries.map((country) => checkoutCoverageForCountry(country))
    : checkoutCoverageMatrix();

  /** Every distinct thing an operator would have to go and do. */
  const todo = [
    ...new Set(
      matrix.flatMap((row) =>
        row.options.filter((option) => option.missing).map((option) => option.missing!)
      )
    )
  ];

  return NextResponse.json({
    ok: true,
    matrix,
    ready: matrix.map((row) => ({
      country: row.country,
      working: row.options.filter((option) => option.available).map((option) => option.kind)
    })),
    todo
  });
}
