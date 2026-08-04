/**
 * Hide the API key inside an RPC URL before it leaves the server.
 *
 * Providers put the key in the path (`.../v2/<key>`) or in a query parameter,
 * so any report that echoes the configured endpoint leaks it to whoever can
 * read the response — and from there into screenshots and chat logs.
 */
export function maskRpcUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);

    for (const key of [...parsed.searchParams.keys()]) {
      parsed.searchParams.set(key, '***');
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    // The key is the trailing segment on every provider we use; short
    // segments like `v2` or `rpc` are path structure, not secrets.
    if (segments.length && segments[segments.length - 1].length > 8) {
      segments[segments.length - 1] = '***';
    }
    parsed.pathname = segments.length ? `/${segments.join('/')}` : '/';

    return parsed.toString();
  } catch {
    return '***';
  }
}
