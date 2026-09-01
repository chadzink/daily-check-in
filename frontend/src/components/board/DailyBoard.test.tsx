import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DailyBoard } from './DailyBoard';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('DailyBoard Component', () => {
  const mockDate = '2026-08-31';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all 4 execution rows: Yesterday, Today, Blocked, and Backlog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/days/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: { id: 's-1', user_id: 'u-1', date: mockDate, notes: '' },
              tasks: {
                yesterday: [
                  {
                    day_task_id: 'dt-y1',
                    task_id: 't-y1',
                    title: 'Completed PR Review Yesterday',
                    description: '',
                    status: 'YESTERDAY',
                    is_completed: true,
                    priority_order: 1,
                  },
                ],
                today: [
                  {
                    day_task_id: 'dt-t1',
                    task_id: 't-t1',
                    title: 'Implement 4-Row Board',
                    description: '',
                    status: 'TODAY',
                    is_completed: false,
                    priority_order: 1,
                  },
                ],
                blocked: [
                  {
                    day_task_id: 'dt-b1',
                    task_id: 't-b1',
                    title: 'Deploy to Cloud Run',
                    description: '',
                    status: 'BLOCKED',
                    is_completed: false,
                    priority_order: 1,
                    blocker_reason: 'Awaiting GCP project quota increase',
                  },
                ],
              },
            }),
          });
        }
        if (url.includes('/api/backlog')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tasks: [
                {
                  id: 't-backlog-1',
                  user_id: 'u-1',
                  title: 'Setup Calendar View',
                  description: '',
                  is_completed: false,
                  is_archived: false,
                  backlog_order: 1,
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    renderWithClient(<DailyBoard date={mockDate} />);

    await waitFor(() => {
      expect(screen.getByTestId('execution-row-yesterday')).toBeInTheDocument();
      expect(screen.getByTestId('execution-row-today')).toBeInTheDocument();
      expect(screen.getByTestId('execution-row-blocked')).toBeInTheDocument();
      expect(screen.getByTestId('execution-row-backlog')).toBeInTheDocument();
    });

    expect(screen.getByText('Completed PR Review Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Implement 4-Row Board')).toBeInTheDocument();
    expect(screen.getByText('Deploy to Cloud Run')).toBeInTheDocument();
    expect(screen.getByText('Awaiting GCP project quota increase')).toBeInTheDocument();
    expect(screen.getByText('Setup Calendar View')).toBeInTheDocument();
  });

  it('optimistically updates task completion checkbox on click', async () => {
    const patchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'dt-t1',
        is_completed: true,
      }),
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (opts?.method === 'PATCH' && url.includes('/api/day-tasks/')) {
          return patchMock();
        }
        if (url.includes('/api/days/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: { id: 's-1', user_id: 'u-1', date: mockDate, notes: '' },
              tasks: {
                yesterday: [],
                today: [
                  {
                    day_task_id: 'dt-t1',
                    task_id: 't-t1',
                    title: 'Implement 4-Row Board',
                    description: '',
                    status: 'TODAY',
                    is_completed: false,
                    priority_order: 1,
                  },
                ],
                blocked: [],
              },
            }),
          });
        }
        if (url.includes('/api/backlog')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tasks: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    const user = userEvent.setup();
    renderWithClient(<DailyBoard date={mockDate} />);

    await waitFor(() => {
      expect(screen.getByText('Implement 4-Row Board')).toBeInTheDocument();
    });

    const checkbox = screen.getByTestId('task-checkbox-dt-t1');
    await user.click(checkbox);

    // Should call patch endpoint
    await waitFor(() => {
      expect(patchMock).toHaveBeenCalled();
    });
  });
});
