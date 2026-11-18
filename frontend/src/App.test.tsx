import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import App from './App';
import * as AuthContextModule from './context/AuthContext';

function renderWithClient(ui: ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('App Component (Milestone 7)', () => {
  const mockLogin = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLogin.mockReset().mockResolvedValue(undefined);
    mockLogout.mockReset().mockResolvedValue(undefined);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/health')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              status: 'healthy',
              timestamp: '2026-11-18T06:00:00Z',
              version: '0.1.0',
            }),
          });
        }
        if (url.includes('/api/backlog')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tasks: [], total: 0 }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            session: { id: '2026-11-18', date: '2026-11-18' },
            tasks: { yesterday: [], today: [], blocked: [] },
          }),
        });
      })
    );
  });

  it('renders LoginPage when unauthenticated and supports demo quick-fill', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: mockLogin,
      logout: mockLogout,
      getIdToken: async () => null,
    });

    renderWithClient(<App />);

    expect(screen.getByText('DailyCheckIn')).toBeInTheDocument();
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('login-fill-demo'));
    expect(screen.getByTestId('login-email-input')).toHaveValue('demo@dailycheckin.com');
    expect(screen.getByTestId('login-password-input')).toHaveValue('Password123!');

    fireEvent.click(screen.getByTestId('login-submit-button'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('demo@dailycheckin.com', 'Password123!');
    });
  });

  it('renders clean main board without Milestone markers or main-page status cards when authenticated', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { uid: 'demo-uid', email: 'demo@dailycheckin.com' } as never,
      isAuthenticated: true,
      isLoading: false,
      login: mockLogin,
      logout: mockLogout,
      getIdToken: async () => 'fake-token',
    });

    renderWithClient(<App />);

    expect(screen.getByText('DailyCheckIn')).toBeInTheDocument();
    expect(screen.getByText('Daily Execution & Ritual Platform')).toBeInTheDocument();

    // No dev stage markers
    expect(screen.queryByText(/Milestone 5/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Milestone 6/i)).not.toBeInTheDocument();

    // No health status indicators on main board
    expect(screen.queryByTestId('status-badge-healthy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    expect(screen.queryByText('Go Echo Backend')).not.toBeInTheDocument();

    // Row-based board container is rendered
    await waitFor(() => {
      expect(screen.getByTestId('daily-board-rows')).toBeInTheDocument();
    });
    expect(screen.getByTestId('daily-board-rows')).toHaveClass('flex-col');

    // Logout button and footer System Health link are present
    expect(screen.getByTestId('logout-button')).toBeInTheDocument();
    expect(screen.getByTestId('footer-health-link')).toBeInTheDocument();
  });

  it('calls logout when Logout button is clicked', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { uid: 'demo-uid', email: 'demo@dailycheckin.com' } as never,
      isAuthenticated: true,
      isLoading: false,
      login: mockLogin,
      logout: mockLogout,
      getIdToken: async () => 'fake-token',
    });

    renderWithClient(<App />);
    fireEvent.click(screen.getByTestId('logout-button'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('opens System Health modal from footer link and displays healthy status', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { uid: 'demo-uid', email: 'demo@dailycheckin.com' } as never,
      isAuthenticated: true,
      isLoading: false,
      login: mockLogin,
      logout: mockLogout,
      getIdToken: async () => 'fake-token',
    });

    renderWithClient(<App />);
    fireEvent.click(screen.getByTestId('footer-health-link'));

    expect(screen.getByTestId('health-modal')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('status-badge-healthy')).toBeInTheDocument();
    });
    expect(screen.getByText(/Backend Connected \(v0.1.0\)/i)).toBeInTheDocument();
    expect(screen.getByText('Go Echo Backend')).toBeInTheDocument();
    expect(screen.getByText('Cloud Firestore')).toBeInTheDocument();
    expect(screen.getByText('Firebase Auth')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('health-modal-close'));
    expect(screen.queryByTestId('health-modal')).not.toBeInTheDocument();
  });

  it('displays offline error banner inside Health modal when backend is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error: connection refused'))
    );
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { uid: 'demo-uid', email: 'demo@dailycheckin.com' } as never,
      isAuthenticated: true,
      isLoading: false,
      login: mockLogin,
      logout: mockLogout,
      getIdToken: async () => 'fake-token',
    });

    renderWithClient(<App />);
    fireEvent.click(screen.getByTestId('footer-health-link'));

    await waitFor(() => {
      expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    });
    expect(screen.getByText('Backend Unreachable')).toBeInTheDocument();
    expect(screen.getByTestId('health-retry-button')).toBeInTheDocument();
  });
});
