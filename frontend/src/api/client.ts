import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export const BASE_URL = '/api';

const INVALID_TOKEN_ERROR_CODES = new Set([
  'auth/invalid-refresh-token',
  'auth/user-token-expired',
  'auth/user-not-found',
  'auth/invalid-user-token',
  'auth/token-expired',
]);

function isInvalidTokenError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && INVALID_TOKEN_ERROR_CODES.has(code)) {
      return true;
    }
  }
  if (err instanceof Error) {
    for (const code of INVALID_TOKEN_ERROR_CODES) {
      if (err.message.includes(code)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Performs a fetch request with the active Firebase user's ID token
 * attached as an Authorization Bearer header when available.
 * Clears stale local auth state if the refresh token is no longer valid.
 */
export async function authFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const currentUser = auth.currentUser;

  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (err) {
      if (isInvalidTokenError(err)) {
        await signOut(auth).catch(() => {});
      }
      throw err;
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

/**
 * Parses a JSON API response or throws a descriptive Error on non-2xx status.
 */
export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || errorBody.error || `HTTP error ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}
