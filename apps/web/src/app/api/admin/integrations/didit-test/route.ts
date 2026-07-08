import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { buildKycUrl, DEFAULT_POST_ONBOARDING_PATH } from '../../../../../lib/auth/kycPaths';
import { siteBaseUrl } from '../../../../../lib/onboarding/accountActivationService';
import {
  createDiditSession,
  diditErrorI18nKey,
  isDiditConfigured,
  parseDiditSessionError
} from '../../../../../lib/onboarding/diditService';

function buildDiditCallbackUrl(): string {
  const kycReturnPath = buildKycUrl(
    DEFAULT_POST_ONBOARDING_PATH,
    DEFAULT_POST_ONBOARDING_PATH,
    undefined,
    { registered: true }
  );
  return `${siteBaseUrl()}${kycReturnPath}${kycReturnPath.includes('?') ? '&' : '?'}didit=1`;
}

export async function POST() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const siteUrl = siteBaseUrl();
  const callbackUrl = buildDiditCallbackUrl();

  if (!isDiditConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: 'DIDIT_NOT_CONFIGURED',
        siteUrl,
        callbackUrl
      },
      { status: 503 }
    );
  }

  if (!/^https?:\/\//i.test(callbackUrl)) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: 'DIDIT_CALLBACK_INVALID',
        siteUrl,
        callbackUrl
      },
      { status: 500 }
    );
  }

  try {
    const session = await createDiditSession({
      userId: 'admin-didit-test',
      callbackUrl
    });

    return NextResponse.json({
      ok: true,
      siteUrl,
      callbackUrl,
      sessionId: session.sessionId,
      urlHost: new URL(session.url).host
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const parsed = parseDiditSessionError(message);

    console.error('[admin/integrations/didit-test]', {
      siteUrl,
      callbackUrl,
      errorCode: parsed.code,
      httpStatus: parsed.httpStatus,
      diditMessage: parsed.diditMessage,
      detailPreview: parsed.detailPreview
    });

    return NextResponse.json(
      {
        ok: false,
        errorCode: parsed.code,
        httpStatus: parsed.httpStatus,
        diditMessage: parsed.diditMessage,
        i18nKey: diditErrorI18nKey(parsed),
        siteUrl,
        callbackUrl
      },
      { status: 502 }
    );
  }
}
