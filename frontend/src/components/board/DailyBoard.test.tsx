import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    window.localStorage.clear();
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
        day_task_id: 'dt-t1',
        is_completed: true,
      }),
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (opts?.method === 'PATCH' && url.includes(`/api/days/${mockDate}/tasks/`)) {
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

  it('supports editing, deleting, blocking via icon, and arrow reordering', async () => {
    const patchTaskMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 't-t1', title: 'Updated Title', description: 'Updated Desc' }),
    });
    const deleteTaskMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archived: true }),
    });
    const blockDayTaskMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ day_task_id: 'dt-t2', status: 'BLOCKED', blocker_reason: 'API down' }),
    });
    const reorderMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (opts?.method === 'PATCH' && url.includes('/api/tasks/t-t1')) {
          return patchTaskMock();
        }
        if (opts?.method === 'DELETE' && url.includes('/api/tasks/t-t1')) {
          return deleteTaskMock();
        }
        if (opts?.method === 'PATCH' && url.includes(`/api/days/${mockDate}/tasks/dt-t2`)) {
          return blockDayTaskMock();
        }
        if (opts?.method === 'PUT' && url.includes('/api/day-tasks/reorder')) {
          return reorderMock();
        }
        if (url.includes('/api/days/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: { id: 's-1', user_id: 'u-1', date: mockDate, notes: '', check_in_at: '2026-08-31T09:00:00Z' },
              tasks: {
                yesterday: [],
                today: [
                  {
                    day_task_id: 'dt-t1',
                    task_id: 't-t1',
                    title: 'First Today Task',
                    description: 'Old Desc',
                    status: 'TODAY',
                    is_completed: false,
                    priority_order: 1,
                  },
                  {
                    day_task_id: 'dt-t2',
                    task_id: 't-t2',
                    title: 'Second Today Task',
                    description: '',
                    status: 'TODAY',
                    is_completed: false,
                    priority_order: 2,
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
      expect(screen.getByText('First Today Task')).toBeInTheDocument();
      expect(screen.getByText('Second Today Task')).toBeInTheDocument();
    });

    // 1. Reorder down on first task
    await user.click(screen.getByTestId('task-move-down-dt-t1'));
    await waitFor(() => {
      expect(reorderMock).toHaveBeenCalled();
    });

    // 2. Edit first task
    await user.click(screen.getByTestId('task-edit-dt-t1'));
    const titleInput = screen.getByLabelText(/Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));
    await waitFor(() => {
      expect(patchTaskMock).toHaveBeenCalled();
    });

    // 3. Block second task via icon
    await user.click(screen.getByTestId('task-block-dt-t2'));
    const reasonInput = screen.getByLabelText(/Blocker Reason/i);
    await user.type(reasonInput, 'API down');
    await user.click(screen.getByRole('button', { name: /Confirm Blocker/i }));
    await waitFor(() => {
      expect(blockDayTaskMock).toHaveBeenCalled();
    });

    // 4. Delete first task via modal confirmation
    await user.click(screen.getByTestId('task-delete-dt-t1'));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Delete Task/i }));
    await waitFor(() => {
      expect(deleteTaskMock).toHaveBeenCalled();
    });
  });

  it('supports detailed add modal with title and description on Today and Blocked rows', async () => {
    const createTaskMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 't-new', title: 'Detailed Task', description: 'More context' }),
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (opts?.method === 'POST' && url.endsWith('/api/tasks')) {
          return createTaskMock(JSON.parse(String(opts.body)));
        }
        if (url.includes('/api/days/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: { id: 's-1', user_id: 'u-1', date: mockDate, notes: '', check_in_at: '2026-08-31T09:00:00Z' },
              tasks: { yesterday: [], today: [], blocked: [] },
            }),
          });
        }
        if (url.includes('/api/backlog')) {
          return Promise.resolve({ ok: true, json: async () => ({ tasks: [] }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    const user = userEvent.setup();
    renderWithClient(<DailyBoard date={mockDate} />);

    await waitFor(() => {
      expect(screen.getByTestId('execution-row-today')).toBeInTheDocument();
      expect(screen.getByTestId('execution-row-blocked')).toBeInTheDocument();
    });

    const todayRow = screen.getByTestId('execution-row-today');
    await user.click(within(todayRow).getByRole('button', { name: /Detailed add task/i }));

    const modal = screen.getByRole('dialog');
    await user.type(within(modal).getByLabelText(/Title/i), 'Detailed Today Task');
    await user.type(within(modal).getByLabelText(/Description/i), 'Detailed notes');
    await user.click(within(modal).getByRole('button', { name: /Add Task/i }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Detailed Today Task',
          description: 'Detailed notes',
          status: 'TODAY',
        })
      );
    });

    const blockedRow = screen.getByTestId('execution-row-blocked');
    await user.click(within(blockedRow).getByRole('button', { name: /Detailed add task/i }));
    const blockedModal = screen.getByRole('dialog');
    await user.type(within(blockedModal).getByLabelText(/Title/i), 'Detailed Blocked Task');
    await user.click(within(blockedModal).getByRole('button', { name: /Add Task/i }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Detailed Blocked Task',
          status: 'BLOCKED',
        })
      );
    });
  });

  it('renders relative date headers on non-current dates and supports Daily Notes modal', async () => {
    const patchSessionMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 's-1',
        user_id: 'u-1',
        date: '2026-11-23',
        notes: '**Updated** markdown note',
      }),
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (opts?.method === 'PATCH' && url.endsWith('/api/days/2026-11-23')) {
          return patchSessionMock(JSON.parse(String(opts.body)));
        }
        if (url.includes('/api/days/2026-11-23')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: {
                id: 's-1',
                user_id: 'u-1',
                date: '2026-11-23',
                notes: '',
                check_in_at: '2026-11-23T09:00:00Z',
              },
              tasks: { yesterday: [], today: [], blocked: [] },
            }),
          });
        }
        if (url.includes('/api/backlog')) {
          return Promise.resolve({ ok: true, json: async () => ({ tasks: [] }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    const user = userEvent.setup();
    renderWithClient(<DailyBoard date="2026-11-23" />);

    await waitFor(() => {
      expect(screen.getByText('Sunday, Nov 22, 2026')).toBeInTheDocument();
      expect(screen.getByText('Monday, Nov 23, 2026')).toBeInTheDocument();
    });

    const notesBtn = screen.getByTestId('daily-notes-btn');
    expect(notesBtn).toHaveAttribute('aria-label', 'Add daily notes');
    await user.click(notesBtn);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTestId('markdown-preview-pane')).toBeInTheDocument();
    await user.click(within(dialog).getByTestId('markdown-tab-write'));
    await user.type(within(dialog).getByRole('textbox'), '**Updated** markdown note');
    await user.click(within(dialog).getByTestId('save-daily-notes-btn'));

    await waitFor(() => {
      expect(patchSessionMock).toHaveBeenCalledWith({ notes: '**Updated** markdown note' });
    });
  });

  it('renders rows in Today -> Yesterday -> Blocked -> Backlog order and shows Yesterday date hint when older', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/days/2026-11-25')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: {
                id: 's-1',
                user_id: 'u-1',
                date: '2026-11-25',
                notes: '',
                check_in_at: '2026-11-25T09:00:00Z',
              },
              yesterday_date: '2026-11-23',
              tasks: {
                yesterday: [
                  {
                    day_task_id: 'dt-y1',
                    task_id: 't-y1',
                    title: 'Monday Shipped Task',
                    description: '',
                    status: 'YESTERDAY',
                    is_completed: true,
                    priority_order: 1,
                  },
                ],
                today: [],
                blocked: [],
              },
            }),
          });
        }
        if (url.includes('/api/backlog')) {
          return Promise.resolve({ ok: true, json: async () => ({ tasks: [] }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    renderWithClient(<DailyBoard date="2026-11-25" />);

    await waitFor(() => {
      expect(screen.getByTestId('daily-board-rows')).toBeInTheDocument();
    });

    const container = screen.getByTestId('daily-board-rows');
    const rowOrder = Array.from(container.children).map((el) => el.getAttribute('data-testid'));
    expect(rowOrder).toEqual([
      'execution-row-today',
      'execution-row-yesterday',
      'execution-row-blocked',
      'execution-row-backlog',
    ]);

    expect(screen.getByTestId('row-subtitle-yesterday')).toHaveTextContent('Mon, Nov 23');
  });

  it('supports collapsing/expanding rows, persists state in localStorage, and auto-expands on N/B shortcuts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/days/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session: {
                id: 's-1',
                user_id: 'u-1',
                date: mockDate,
                notes: '',
                check_in_at: '2026-08-31T09:00:00Z',
              },
              tasks: {
                yesterday: [
                  {
                    day_task_id: 'dt-y1',
                    task_id: 't-y1',
                    title: 'Yesterday Done Task',
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
                    title: 'Today Active Task',
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
            json: async () => ({
              tasks: [
                {
                  id: 't-b1',
                  user_id: 'u-1',
                  title: 'Backlog Task Item',
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

    const user = userEvent.setup();
    const { unmount } = renderWithClient(<DailyBoard date={mockDate} />);

    await waitFor(() => {
      expect(screen.getByText('Yesterday Done Task')).toBeInTheDocument();
      expect(screen.getByText('Backlog Task Item')).toBeInTheDocument();
    });

    // Collapse Yesterday and Backlog
    const yesterdayToggle = screen.getByTestId('toggle-row-yesterday');
    const backlogToggle = screen.getByTestId('toggle-row-backlog');
    expect(yesterdayToggle).toHaveAttribute('aria-expanded', 'true');
    expect(backlogToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(yesterdayToggle);
    await user.click(backlogToggle);

    expect(yesterdayToggle).toHaveAttribute('aria-expanded', 'false');
    expect(backlogToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Yesterday Done Task')).not.toBeInTheDocument();
    expect(screen.queryByText('Backlog Task Item')).not.toBeInTheDocument();
    // Quick Add input in Backlog should be hidden when collapsed
    expect(screen.queryByPlaceholderText(/Add task to Backlog/i)).not.toBeInTheDocument();

    // Unmount and remount to simulate reload — collapsed state should persist via localStorage
    unmount();
    renderWithClient(<DailyBoard date={mockDate} />);

    await waitFor(() => {
      expect(screen.getByTestId('toggle-row-yesterday')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('toggle-row-backlog')).toHaveAttribute('aria-expanded', 'false');
    });
    expect(screen.queryByText('Yesterday Done Task')).not.toBeInTheDocument();
    expect(screen.queryByText('Backlog Task Item')).not.toBeInTheDocument();

    // Pressing 'b' should auto-expand Backlog and focus its Quick Add input
    await user.keyboard('b');
    await waitFor(() => {
      expect(screen.getByTestId('toggle-row-backlog')).toHaveAttribute('aria-expanded', 'true');
      const backlogInput = screen.getByPlaceholderText(/Add task to Backlog/i);
      expect(backlogInput).toBeInTheDocument();
      expect(backlogInput).toHaveFocus();
    });
  });
});
