import { NextResponse } from 'next/server';
import { probeMorphoLending } from '../../../../lib/lending/morphoLendingProbe';

export const dynamic = 'force-dynamic';

export async function GET() {
  const morpho = await probeMorphoLending();
  return NextResponse.json({ ok: morpho.ok, morpho });
}
