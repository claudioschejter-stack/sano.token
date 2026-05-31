import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import {
  getSerializedActivePolicy,
  saveCommissionPolicy,
  serializePolicy,
  type PolicyInput
} from '../../../../../lib/commission/commissionPolicyService';
import { evaluateAllAdvisorCategories } from '../../../../../lib/commission/advisorCategoryService';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const policy = await getSerializedActivePolicy();
  return NextResponse.json({ policy });
}

export async function PATCH(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PolicyInput;
  const session = await auth();

  try {
    const saved = await saveCommissionPolicy(body, session?.user?.id ?? undefined);
    await evaluateAllAdvisorCategories();
    return NextResponse.json({ ok: true, policy: serializePolicy(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SAVE_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get('action') !== 'evaluate-categories') {
    return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
  }

  const results = await evaluateAllAdvisorCategories();
  return NextResponse.json({ ok: true, evaluated: results.length, results });
}
