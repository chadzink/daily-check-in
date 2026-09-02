import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { CheckOutModal } from './CheckOutModal';
import { DaySessionWithTasks } from '../../types/domain';

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

describe('CheckOutModal Component', () => {
  const mockDate = '2026-09-01';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders accomplishment review, accepts reflection notes, and submits check-out', async () => {
    const mockSession: DaySessionWithTasks = {
      session: {
        id: 's-1',
        user_id: 'u-1',
        date: mockDate,
        check_in_at: '2026-09-01T09:00:00Z',
        check_out_at: null,
        notes: '',
        created_at: '',
        updated_at: '',
      },
      tasks: {
        yesterday: [],
        today: [
          {
            day_task_id: 'dt-1',
            task_id: 't-1',
            title: 'Completed Focus Item',
            description: '',
            status: 'TODAY',
            is_completed: true,
            priority_order: 1,
          },
          {
            day_task_id: 'dt-2',
            task_id: 't-2',
            title: 'Unfinished Stretch Goal',
            description: '',
            status: 'TODAY',
            is_completed: false,
            priority_order: 2,
          },
        ],
        blocked: [],
      },
    };

    let checkOutSubmitted = false;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes('/api/days/') && url.includes('/check-out') && opts?.method === 'POST') {
          checkOutSubmitted = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ...mockSession,
              session: {
                ...mockSession.session,
                check_out_at: new Date().toISOString(),
                notes: 'Shipped milestone 4 features',
              },
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );

    const handleClose = vi.fn();
    renderWithClient(
      <CheckOutModal
        isOpen={true}
        onClose={handleClose}
        date={mockDate}
        sessionWithTasks={mockSession}
      />
    );

    // Step 1: Accomplished Today & Unfinished Work Triage
    expect(screen.getByText(/Accomplished Today/i)).toBeInTheDocument();
    expect(screen.getByText('Completed Focus Item')).toBeInTheDocument();
    expect(screen.getByText('Unfinished Stretch Goal')).toBeInTheDocument();

    // Advance to Step 2: Daily Reflection
    const nextBtn = screen.getByRole('button', { name: /Continue to Reflection/i });
    await userEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText(/Daily Reflection & State Closure/i)).toBeInTheDocument();
    });

    // Enter reflection notes
    const textarea = screen.getByPlaceholderText(/What went well today/i);
    await userEvent.type(textarea, 'Shipped milestone 4 features');

    // Submit check-out
    const submitBtn = screen.getByRole('button', { name: /Sign-Off & Close Workday/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(checkOutSubmitted).toBe(true);
    });
  });
});
