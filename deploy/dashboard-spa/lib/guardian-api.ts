export type GuardianHeaders = Record<string, string>;

/** API origin: query/env override, else same-origin relative paths (`/api/...`). */
export function resolveApiBase(): string {
  if (typeof window === 'undefined') return '';
  const fromQuery = new URLSearchParams(window.location.search).get('apiBase');
  if (fromQuery) return fromQuery.replace(/\/$/, '');
  const envBase = process.env.NEXT_PUBLIC_GUARDIAN_API;
  if (envBase) return envBase.replace(/\/$/, '');
  return '';
}

export function buildAuthHeaders(): GuardianHeaders {
  const headers: GuardianHeaders = { Accept: 'application/json' };
  if (typeof window === 'undefined') return headers;
  const params = new URLSearchParams(window.location.search);
  const apiKey = params.get('apiKey');
  if (apiKey) headers['X-API-Key'] = apiKey;
  return headers;
}

export async function guardianFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = resolveApiBase();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = path.startsWith('http') ? path : base ? `${base}${normalized}` : normalized;
  return fetch(url, {
    ...init,
    headers: { ...buildAuthHeaders(), ...(init?.headers as GuardianHeaders) },
  });
}
