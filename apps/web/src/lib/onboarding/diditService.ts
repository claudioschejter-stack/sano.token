import { createHmac, timingSafeEqual } from 'crypto';

const DIDIT_SESSION_URL = 'https://verification.didit.me/v3/session/';

export type DiditSessionResult = {
  sessionId: string;
  url: string;
  sessionToken?: string;
};

export function isDiditConfigured(): boolean {
  return Boolean(process.env.DIDIT_API_KEY?.trim() && process.env.DIDIT_WORKFLOW_ID?.trim());
}

export async function createDiditSession(input: {
  userId: string;
  callbackUrl: string;
}): Promise<DiditSessionResult> {
  const apiKey = process.env.DIDIT_API_KEY?.trim();
  const workflowId = process.env.DIDIT_WORKFLOW_ID?.trim();

  if (!apiKey || !workflowId) {
    throw new Error('DIDIT_NOT_CONFIGURED');
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  const callback = input.callbackUrl.startsWith('http')
    ? input.callbackUrl
    : `${siteUrl}${input.callbackUrl}`;

  const response = await fetch(DIDIT_SESSION_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: input.userId,
      callback
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`DIDIT_SESSION_FAILED:${response.status}:${detail}`);
  }

  const payload = (await response.json()) as {
    session_id?: string;
    id?: string;
    url?: string;
    session_token?: string;
  };

  const sessionId = payload.session_id ?? payload.id;
  const url = payload.url;

  if (!sessionId || !url) {
    throw new Error('DIDIT_SESSION_INVALID_RESPONSE');
  }

  return {
    sessionId,
    url,
    sessionToken: payload.session_token
  };
}

export function verifyDiditWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !signatureHeader) {
    return process.env.NODE_ENV !== 'production';
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export function mapDiditStatusToKyc(status: string | undefined): 'APPROVED' | 'REJECTED' | 'PENDING' {
  const normalized = (status ?? '').toLowerCase();

  if (['approved', 'verified', 'success', 'completed'].some((s) => normalized.includes(s))) {
    return 'APPROVED';
  }

  if (['rejected', 'declined', 'failed', 'expired'].some((s) => normalized.includes(s))) {
    return 'REJECTED';
  }

  return 'PENDING';
}
