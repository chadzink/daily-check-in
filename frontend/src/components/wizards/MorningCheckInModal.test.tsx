import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { MorningCheckInModal } from './MorningCheckInModal';

function renderWithClient(ui: ReactElement) {
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

describe('MorningCheckInModal Component', () => {
  const mockDate = '2026-09-01';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('progresses through 4 ritual steps and submits check-in', async () => {
    const mockContext = {
      target_date: mockDate,
      previous_date: '2026-08-31',
      yesterday_tasks: [
        {
          day_task_id: 'dt-y1',
          task_id: 't-y1',
          title: 'Yesterday Completed Task',
          description: '',
          status: 'YESTERDAY',
          is_completed: true,
          priority_order: 1,
        },
      ],
      rollover_candidates: [
        {
          day_task_id: 'dt-r1',
          task_id: 't-r1',
          title: 'Rollover Candidate Task',
          description: '',
          status: 'TODAY',
          is_completed: false,
          priority_order: 1,
        },
      ],
      backlog_tasks: [
        {
          id: 't-b1',
          user_id: 'u-1',
          title: 'Global Backlog Item',
          description: '',
          is_completed: false,
          is_archived: false,
          backlog_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      is_already_checked_in: false,
    };

    let checkInSubmitted = false;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes('/api/days/') && url.includes('/check-in/context')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockContext,
          });
        }
        if (url.includes('/api/days/') && url.includes('/check-in') && opts?.method === 'POST') {
          checkInSubmitted = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: { id: 's-1', user_id: 'u-1', date: mockDate, check_in_at: new Date().toISOString() },
              tasks: { yesterday: [], today: [], blocked: [] },
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );

    const handleClose = vi.fn();
    renderWithClient(
      <MorningCheckInModal isOpen={true} onClose={handleClose} date={mockDate} />
    );

    // Step 1: Yesterday Accomplishments
    await waitFor(() => {
      expect(screen.getByText("Yesterday's Accomplishments")).toBeInTheDocument();
    });
    expect(screen.getByText('Yesterday Completed Task')).toBeInTheDocument();

    // Advance to Step 2: Rollover Triage
    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    await userEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText('Incomplete Work Rollover Triage')).toBeInTheDocument();
    });
    expect(screen.getByText('Rollover Candidate Task')).toBeInTheDocument();

    // Advance to Step 3: Backlog Pull
    await userEvent.click(screen.getByRole('button', { name: /Next Step/i }));

    await waitFor(() => {
      expect(screen.getByText('Pull from Global Backlog')).toBeInTheDocument();
    });
    expect(screen.getByText('Global Backlog Item')).toBeInTheDocument();

    // Select backlog item
    await userEvent.click(screen.getByText('Global Backlog Item'));

    // Advance to Step 4: Prioritize Commitments
    await userEvent.click(screen.getByRole('button', { name: /Next Step/i }));

    await waitFor(() => {
      expect(screen.getByText("Prioritize Today's Commitments")).toBeInTheDocument();
    });

    // Commit Morning Check-In
    const commitBtn = screen.getByRole('button', { name: /Commit Today's Ritual/i });
    await userEvent.click(commitBtn);

    await waitFor(() => {
      expect(checkInSubmitted).toBe(true);
    });
  });

  it('defaults blocked rollover candidates to KEEP_BLOCKED, displays blocker reason, omits them from Step 4, and submits KEEP_BLOCKED', async () => {
    const mockContext = {
      target_date: mockDate,
      previous_date: '2026-08-31',
      yesterday_tasks: [],
      rollover_candidates: [
        {
          day_task_id: 'dt-today-1',
          task_id: 't-today-1',
          title: 'Unfinished Today Task',
          description: '',
          status: 'TODAY',
          is_completed: false,
          priority_order: 1,
          subtasks: [],
        },
        {
          day_task_id: 'dt-blocked-1',
          task_id: 't-blocked-1',
          title: 'Blocked Vendor Integration',
          description: '',
          status: 'BLOCKED',
          is_completed: false,
          priority_order: 1,
          blocker_reason: 'Waiting on QA sign-off',
          subtasks: [],
        },
      ],
      backlog_tasks: [],
      is_already_checked_in: false,
    };

    let submittedPayload: Record<string, unknown> | null = null;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes('/check-in/context')) {
          return Promise.resolve({ ok: true, json: async () => mockContext });
        }
        if (url.includes('/check-in') && opts?.method === 'POST') {
          submittedPayload = JSON.parse(String(opts.body));
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: { id: 's-1', user_id: 'u-1', date: mockDate, check_in_at: new Date().toISOString() },
              tasks: { yesterday: [], today: [], blocked: [] },
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );

    renderWithClient(
      <MorningCheckInModal isOpen={true} onClose={vi.fn()} date={mockDate} />
    );

    // Advance Step 1 -> Step 2
    await waitFor(() => {
      expect(screen.getByText("Yesterday's Accomplishments")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /Next Step/i }));

    // Verify blocked card renders badge, blocker reason, Keep Blocked selected, and helper note
    await waitFor(() => {
      expect(screen.getByTestId('rollover-blocked-badge-t-blocked-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('rollover-blocker-reason-t-blocked-1')).toHaveTextContent(
      'Waiting on QA sign-off'
    );
    const blockedCard = screen.getByTestId('rollover-card-t-blocked-1');
    expect(within(blockedCard).getByRole('radio', { name: /Keep Blocked/i })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByTestId('keep-blocked-helper-note')).toBeInTheDocument();

    // Advance Step 2 -> Step 3 -> Step 4
    await userEvent.click(screen.getByRole('button', { name: /Next Step/i }));
    await userEvent.click(screen.getByRole('button', { name: /Next Step/i }));

    // Step 4 includes Today task and omits KEEP_BLOCKED task
    await waitFor(() => {
      expect(screen.getByText("Prioritize Today's Commitments")).toBeInTheDocument();
    });
    expect(screen.getByText('Unfinished Today Task')).toBeInTheDocument();
    expect(screen.queryByText('Blocked Vendor Integration')).not.toBeInTheDocument();

    // Commit and verify payload
    await userEvent.click(screen.getByRole('button', { name: /Commit Today's Ritual/i }));
    await waitFor(() => {
      expect(submittedPayload).not.toBeNull();
    });
    expect(submittedPayload).toEqual(
      expect.objectContaining({
        today_task_ids: ['t-today-1'],
        rollover_decisions: expect.arrayContaining([
          expect.objectContaining({
            task_id: 't-blocked-1',
            action: 'KEEP_BLOCKED',
            blocker_reason: 'Waiting on QA sign-off',
          }),
          expect.objectContaining({
            task_id: 't-today-1',
            action: 'ROLLOVER',
          }),
        ]),
      })
    );
  });
});
