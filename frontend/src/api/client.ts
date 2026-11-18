import { auth } from '../firebase';

export const BASE_URL = '/api';

/**
 * Performs a fetch request with the active Firebase user's ID token
 * attached as an Authorization Bearer header when available.
 */
export async function authFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const currentUser = auth.currentUser;

  if (currentUser) {
    const token = await currentUser.getIdToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
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
