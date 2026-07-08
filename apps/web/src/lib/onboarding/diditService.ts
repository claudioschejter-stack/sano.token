import { createHmac, timingSafeEqual } from 'crypto';
import { siteBaseUrl } from './accountActivationService';

const DIDIT_SESSION_URL = 'https://verification.didit.me/v3/session/';

/**
 * Whole-number floats (1.0) → integers (1), recursively.
 * Matches Didit's server-side canonicalisation for X-Signature-V2.
 */
function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)])
    );
  }
  if (typeof v === 'number' && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

/**
 * Recursive lexicographic key sort (array order preserved).
 * Required for X-Signature-V2 canonicalisation.
 */
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === 'object') {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

export type DiditSessionResult = {
  sessionId: string;
  url: string;
  sessionToken?: string;
};

export type ParsedDiditSessionError = {
  code: string;
  httpStatus?: number;
  diditMessage?: string;
  detailPreview?: string;
};

export function isDiditConfigured(): boolean {
  return Boolean(process.env.DIDIT_API_KEY?.trim() && process.env.DIDIT_WORKFLOW_ID?.trim());
}

function extractDiditErrorDetail(detail: string): string | undefined {
  const trimmed = detail.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const candidate = parsed.detail ?? parsed.message ?? parsed.error ?? parsed.title;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 200);
    }
    if (candidate && typeof candidate === 'object') {
      return JSON.stringify(candidate).slice(0, 200);
    }
  } catch {
    /* plain text body */
  }

  return trimmed.replace(/\s+/g, ' ').slice(0, 200);
}

/** Parses server-side Didit errors for admin diagnostics and onboarding UI. */
export function parseDiditSessionError(message: string): ParsedDiditSessionError {
  if (message === 'DIDIT_NOT_CONFIGURED') {
    return { code: 'DIDIT_NOT_CONFIGURED' };
  }

  if (message === 'DIDIT_SESSION_INVALID_RESPONSE') {
    return { code: 'DIDIT_SESSION_INVALID_RESPONSE' };
  }

  if (message === 'DIDIT_CALLBACK_INVALID') {
    return { code: 'DIDIT_CALLBACK_INVALID' };
  }

  const failedMatch = message.match(/^DIDIT_SESSION_FAILED:(\d+):(.*)$/s);
  if (failedMatch) {
    const httpStatus = Number(failedMatch[1]);
    const detail = failedMatch[2] ?? '';
    return {
      code: 'DIDIT_SESSION_FAILED',
      httpStatus: Number.isFinite(httpStatus) ? httpStatus : undefined,
      diditMessage: extractDiditErrorDetail(detail),
      detailPreview: detail.slice(0, 200)
    };
  }

  if (message.startsWith('DIDIT_')) {
    return { code: message.split(':')[0] ?? message, detailPreview: message.slice(0, 200) };
  }

  return { code: 'GENERIC', detailPreview: message.slice(0, 200) };
}

/** Maps parsed Didit errors to onboarding i18n keys. */
export function diditErrorI18nKey(parsed: ParsedDiditSessionError): string {
  if (parsed.code === 'DIDIT_NOT_CONFIGURED') {
    return 'DIDIT_NOT_CONFIGURED';
  }
  if (parsed.code === 'DIDIT_SESSION_INVALID_RESPONSE') {
    return 'DIDIT_SESSION_INVALID_RESPONSE';
  }
  if (parsed.code === 'DIDIT_CALLBACK_INVALID') {
    return 'DIDIT_CALLBACK_INVALID';
  }
  if (parsed.httpStatus === 401 || parsed.httpStatus === 403) {
    return 'DIDIT_AUTH_FAILED';
  }
  if (parsed.httpStatus === 404) {
    return 'DIDIT_WORKFLOW_NOT_FOUND';
  }
  if (parsed.httpStatus === 402 || parsed.httpStatus === 429) {
    return 'DIDIT_QUOTA_EXCEEDED';
  }
  if (parsed.code.startsWith('DIDIT_')) {
    return 'DIDIT_SESSION_FAILED';
  }
  return 'GENERIC';
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

  const siteUrl = siteBaseUrl();
  const callback = input.callbackUrl.startsWith('http')
    ? input.callbackUrl
    : `${siteUrl}${input.callbackUrl.startsWith('/') ? '' : '/'}${input.callbackUrl}`;

  const response = await fetch(DIDIT_SESSION_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: input.userId,
      callback,
      callback_method: 'both',
      language: 'es'
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`DIDIT_SESSION_FAILED:${response.status}:${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    session_id?: string;
    sessionId?: string;
    id?: string;
    url?: string;
    verification_url?: string;
    session_url?: string;
    session_token?: string;
  };

  const sessionId = payload.session_id ?? payload.sessionId ?? payload.id;
  const url = payload.url ?? payload.verification_url ?? payload.session_url;

  if (!sessionId || !url) {
    throw new Error('DIDIT_SESSION_INVALID_RESPONSE');
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error('DIDIT_SESSION_INVALID_RESPONSE');
  }

  return {
    sessionId,
    url,
    sessionToken: payload.session_token
  };
}

export async function retrieveDiditDecision(sessionId: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.DIDIT_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('DIDIT_NOT_CONFIGURED');
  }

  const response = await fetch(`${DIDIT_SESSION_URL}${encodeURIComponent(sessionId)}/decision/`, {
    headers: {
      'x-api-key': apiKey
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`DIDIT_DECISION_FAILED:${response.status}:${detail}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

/**
 * Verifies Didit's X-Signature-V2 header using the canonical HMAC-SHA256 algorithm.
 *
 * Didit signs: JSON.stringify(sortKeys(shortenFloats(parsedBody))) with unescaped Unicode.
 * This differs from X-Signature which signs the raw bytes — using the wrong algorithm
 * causes ALL webhooks to be rejected silently in production.
 *
 * @see https://docs.didit.me/integration/webhooks
 */
export function verifyDiditWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !signatureHeader) {
    return process.env.NODE_ENV !== 'production';
  }

  try {
    // Canonicalise: shortenFloats → sortKeys → JSON.stringify (unescaped Unicode, JS default)
    const parsed = JSON.parse(rawBody) as unknown;
    const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));

    const expected = createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
    const provided = signatureHeader.replace(/^sha256=/i, '').trim();

    if (expected.length !== provided.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

/**
 * Maps Didit v3 session status literals (case-sensitive) to internal KYC status.
 * Didit status strings: "Not Started", "In Progress", "Awaiting User", "In Review",
 * "Approved", "Declined", "Resubmitted", "Abandoned", "Expired", "Kyc Expired".
 */
export function mapDiditStatusToKyc(status: string | undefined): 'APPROVED' | 'REJECTED' | 'PENDING' {
  const normalized = (status ?? '').toLowerCase().trim();

  const approvedStatuses = new Set(['approved', 'verified', 'success', 'completed', 'passed', 'accept']);
  // "Kyc Expired" means a previously approved user's KYC aged out — treat as rejected to require re-verification
  const rejectedStatuses = new Set([
    'rejected',
    'declined',
    'failed',
    'expired',
    'kyc expired',
    'denied',
    'abandoned'
  ]);

  if (approvedStatuses.has(normalized)) {
    return 'APPROVED';
  }

  if (rejectedStatuses.has(normalized)) {
    return 'REJECTED';
  }

  // "Not Started", "In Progress", "Awaiting User", "In Review", "Resubmitted" → PENDING
  return 'PENDING';
}
