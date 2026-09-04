import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import App from './App';

function renderWithClient(ui: React.ReactElement) {
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

describe('App Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders application header and title correctly', () => {
    // Mock successful fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'healthy',
        timestamp: '2026-08-28T05:00:00Z',
        version: '0.1.0',
      }),
    }));

    renderWithClient(<App />);
    expect(screen.getByText('DailyCheckIn')).toBeInTheDocument();
    expect(screen.getByText('Daily Execution & Ritual Platform')).toBeInTheDocument();
  });

  it('displays connected status badge when backend health check succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'healthy',
        timestamp: '2026-08-28T05:00:00Z',
        version: '0.1.0',
      }),
    }));

    renderWithClient(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('status-badge-healthy')).toBeInTheDocument();
    });
    expect(screen.getByText(/Backend Connected \(v0.1.0\)/i)).toBeInTheDocument();
  });

  it('displays offline error banner when backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error: connection refused')));

    renderWithClient(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    });
    expect(screen.getByText('Backend Unreachable')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge-error')).toBeInTheDocument();
  });
});
