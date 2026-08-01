/**
 * Safely parse a fetch Response as JSON.
 * When platforms/CDNs return HTML error pages (DOCTYPE), res.json() throws a
 * cryptic "Unexpected token '<'" — this surfaces status + a stable error code.
 */
export async function readJsonResponse<T extends Record<string, unknown> = Record<string, unknown>>(
  response: Response
): Promise<{ ok: boolean; status: number; data: T; errorCode: string | null }> {
  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      ok: response.ok,
      status: response.status,
      data: {} as T,
      errorCode: response.ok ? null : `HTTP_${response.status}_EMPTY`
    };
  }

  const looksLikeHtml =
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    (!contentType.includes('application/json') && trimmed.startsWith('<'));

  if (looksLikeHtml) {
    return {
      ok: false,
      status: response.status,
      data: {} as T,
      errorCode:
        response.status === 404 ? 'PAY_ENDPOINT_NOT_FOUND' : `HTTP_${response.status}_HTML_RESPONSE`
    };
  }

  try {
    const data = JSON.parse(trimmed) as T;
    const errorField = (data as unknown as { error?: unknown }).error;
    const errorCode =
      typeof errorField === 'string' ? errorField : response.ok ? null : `HTTP_${response.status}`;
    return { ok: response.ok, status: response.status, data, errorCode };
  } catch {
    return {
      ok: false,
      status: response.status,
      data: {} as T,
      errorCode: 'INVALID_JSON_RESPONSE'
    };
  }
}
