const TOKEN_KEY = 'sonify.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown };

export async function api<T = any>(path: string, options: Options = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getToken();

  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new ApiError('Sessão expirada', 401);
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) throw new ApiError(data?.error || `Erro ${res.status}`, res.status);
  return data as T;
}

/** URL de streaming: o token vai na query porque <audio>/<video> não mandam header. */
export const streamUrl = (id: number) => `/api/stream/${id}?t=${encodeURIComponent(getToken() || '')}`;

/** Capa extraída das tags, ou null pra cair no degradê. */
export const coverUrl = (cover: string | null | undefined) => (cover ? `/covers/${cover}` : null);
