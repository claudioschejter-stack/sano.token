const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const API_BASE_PATH = '/api/v1';
const TOKEN_STORAGE_KEY = 'sanova.jwt';

type ApiClientOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | null;
};

function getAuthToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export async function apiClient<TResponse = unknown>(path: string, options: ApiClientOptions = {}): Promise<TResponse> {
  const headers = new Headers(options.headers);
  const token = getAuthToken();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let requestBody: BodyInit | null | undefined;
  if (
    options.body &&
    typeof options.body === 'object' &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob) &&
    !(options.body instanceof URLSearchParams) &&
    !(options.body instanceof ArrayBuffer)
  ) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(options.body);
  } else {
    requestBody = options.body as BodyInit | null | undefined;
  }

  const response = await fetch(`${API_URL}${API_BASE_PATH}${normalizedPath}`, {
    ...options,
    headers,
    body: requestBody,
    cache: 'no-store'
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Sanova API request failed with status ${response.status}`);
  }

  const responseText = await response.text();
  return (responseText ? JSON.parse(responseText) : undefined) as TResponse;
}
