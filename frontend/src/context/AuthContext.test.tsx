import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

function AuthConsumer() {
  const { user, isAuthenticated, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user ? user.uid : 'null'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears queryClient cache and resets auth state when onAuthStateChanged emits null', () => {
    let authCallback: ((user: unknown) => void) | undefined;
    const unsubscribe = vi.fn();
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, cb) => {
      authCallback = cb as (user: unknown) => void;
      return unsubscribe;
    });

    const queryClient = new QueryClient();
    queryClient.setQueryData(['dailyBoard', '2026-11-21'], { stale: true });
    const clearSpy = vi.spyOn(queryClient, 'clear');

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');

    act(() => {
      authCallback?.({ uid: 'user-123' });
    });

    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('user-123');
    expect(clearSpy).not.toHaveBeenCalled();

    act(() => {
      authCallback?.(null);
    });

    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['dailyBoard', '2026-11-21'])).toBeUndefined();
  });
});
