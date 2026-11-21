import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { authFetch } from './client';

vi.mock('firebase/auth', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

describe('authFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as { currentUser: unknown }).currentUser = null;
  });

  it('signs out and rethrows when getIdToken fails with auth/invalid-refresh-token', async () => {
    const tokenError = Object.assign(
      new Error('Firebase: Error (auth/invalid-refresh-token).'),
      { code: 'auth/invalid-refresh-token' }
    );
    (auth as unknown as { currentUser: unknown }).currentUser = {
      getIdToken: vi.fn().mockRejectedValue(tokenError),
    };

    await expect(authFetch('/api/health')).rejects.toThrow(
      'auth/invalid-refresh-token'
    );
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it('attaches Bearer token when getIdToken succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    (auth as unknown as { currentUser: unknown }).currentUser = {
      getIdToken: vi.fn().mockResolvedValue('valid-jwt-token'),
    };

    await authFetch('/api/health');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer valid-jwt-token');
    expect(signOut).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('signs out and rethrows when getIdToken fails with message-only auth/invalid-refresh-token', async () => {
    const tokenError = new Error('Firebase: Error (auth/invalid-refresh-token).');
    (auth as unknown as { currentUser: unknown }).currentUser = {
      getIdToken: vi.fn().mockRejectedValue(tokenError),
    };

    await expect(authFetch('/api/health')).rejects.toThrow(
      'auth/invalid-refresh-token'
    );
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it('rethrows without signing out on non-invalid-token errors', async () => {
    const networkError = new Error('Network unavailable');
    (auth as unknown as { currentUser: unknown }).currentUser = {
      getIdToken: vi.fn().mockRejectedValue(networkError),
    };

    await expect(authFetch('/api/health')).rejects.toThrow('Network unavailable');
    expect(signOut).not.toHaveBeenCalled();
  });
});
