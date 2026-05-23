import { NextResponse } from 'next/server';
import { getAdminSettings } from '../../../../lib/admin/getAdminSettings';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  updatePlatformConfig,
  type UpdatePlatformConfigInput
} from '../../../../lib/platform/platformConfigService';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const settings = await getAdminSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[admin/settings GET]', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as UpdatePlatformConfigInput;
    const contact = await updatePlatformConfig(body);
    const settings = await getAdminSettings();

    return NextResponse.json({
      ...settings,
      contact
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';

    if (
      message === 'invalid_whatsapp' ||
      message === 'invalid_email' ||
      message === 'invalid_site_url'
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[admin/settings PATCH]', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
