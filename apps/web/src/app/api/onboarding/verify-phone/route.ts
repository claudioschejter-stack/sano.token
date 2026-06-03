import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'PHONE_VERIFICATION_DISABLED' }, { status: 410 });
}
