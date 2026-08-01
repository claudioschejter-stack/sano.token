import { describe, expect, it } from 'vitest';
import { readJsonResponse } from './readJsonResponse';

describe('readJsonResponse', () => {
  it('parses JSON bodies', async () => {
    const response = new Response(JSON.stringify({ ok: true, status: 'settled' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
    const result = await readJsonResponse(response);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ ok: true, status: 'settled' });
    expect(result.errorCode).toBeNull();
  });

  it('maps HTML error pages to a stable code instead of throwing', async () => {
    const response = new Response('<!DOCTYPE html><html><body>Not Found</body></html>', {
      status: 404,
      headers: { 'content-type': 'text/html' }
    });
    const result = await readJsonResponse(response);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('PAY_ENDPOINT_NOT_FOUND');
  });
});
