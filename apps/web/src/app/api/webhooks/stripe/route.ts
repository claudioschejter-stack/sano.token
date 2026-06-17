import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Stripe deshabilitado: todas las compras fiat usan on-ramps → USDC Base treasury. */
export async function POST() {
  return NextResponse.json({ ok: true, ignored: 'stripe_disabled' });
}
