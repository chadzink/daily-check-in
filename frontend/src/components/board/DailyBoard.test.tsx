import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { DailyBoard } from './DailyBoard';

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

  it('disables Backlog pull button and P shortcut on past dates while allowing Backlog reordering and passes ?today= to backlog', async () => {
    const pullMock = vi.fn();
    const reorderBacklogMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST' && url.includes('/pull')) {
        pullMock();
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      if (opts?.method === 'PUT' && url.includes('/api/backlog/reorder')) {
        return reorderBacklogMock();
      }
      if (url.includes('/api/days/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            session: { id: 's-past', user_id: 'u-1', date: '2026-11-24', notes: '', check_in_at: '2026-11-24T09:00:00Z' },
            tasks: { yesterday: [], today: [], blocked: [] },
          }),
        });
      }
      if (url.includes('/api/backlog')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tasks: [
              { id: 'tb-1', user_id: 'u-1', title: 'Backlog First', description: '', is_completed: false, is_archived: false, backlog_order: 1, subtasks: [] },
              { id: 'tb-2', user_id: 'u-1', title: 'Backlog Second', description: '', is_completed: false, is_archived: false, backlog_order: 2, subtasks: [] },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderWithClient(<DailyBoard date="2026-11-24" isReadOnly={true} />);

    await waitFor(() => {
      expect(screen.getByText('Backlog First')).toBeInTheDocument();
    });

    // Backlog fetch includes ?today=
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/backlog\?today=\d{4}-\d{2}-\d{2}/),
      expect.anything()
    );

    // Pull button is disabled with tooltip
    const pullBtn = screen.getByTestId('task-pull-tb-1');
    expect(pullBtn).toBeDisabled();
    expect(pullBtn).toHaveAttribute('title', 'Cannot pull tasks into a past date');

    // P shortcut hint is muted & pressing P does not trigger pull
    expect(screen.getByTestId('shortcut-pull-hint').className).toContain('line-through');
    await user.keyboard('p');
    expect(pullMock).not.toHaveBeenCalled();

    // Backlog reordering still works on past dates
    await user.click(screen.getByTestId('task-move-down-tb-1'));
    await waitFor(() => {
      expect(reorderBacklogMock).toHaveBeenCalled();
    });
  });

  it('moves a task to a future date via EditTaskModal and cascades parent completion to subtasks optimistically', async () => {
    let parentCompleted = false;
    const moveMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ day_task_id: 'dt-future', task_id: 't-1', title: 'Active Task', status: 'TODAY', subtasks: [] }),
    });
    const patchDayTaskMock = vi.fn().mockImplementation(() => {
      parentCompleted = true;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          day_task_id: 'dt-1',
          task_id: 't-1',
          title: 'Active Task',
          status: 'TODAY',
          is_completed: true,
          subtasks: [
            { id: 's-1', title: 'Sub One', is_completed: true, order: 1 },
            { id: 's-2', title: 'Sub Two', is_completed: true, order: 2 },
          ],
        }),
      });
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (opts?.method === 'POST' && url.includes('/api/tasks/t-1/move')) {
          return moveMock(JSON.parse(String(opts.body)));
        }
        if (opts?.method === 'PATCH' && url.includes(`/api/days/${mockDate}/tasks/dt-1`)) {
          return patchDayTaskMock();
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
                    day_task_id: 'dt-1',
                    task_id: 't-1',
                    title: 'Active Task',
                    description: 'Some desc',
                    status: 'TODAY',
                    is_completed: parentCompleted,
                    priority_order: 1,
                    subtasks: [
                      { id: 's-1', title: 'Sub One', is_completed: true, order: 1 },
                      { id: 's-2', title: 'Sub Two', is_completed: parentCompleted, order: 2 },
                    ],
                  },
                ],
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

    const user = userEvent.setup();
    renderWithClient(<DailyBoard date={mockDate} />);

    await waitFor(() => {
      expect(screen.getByTestId('task-subtask-badge-dt-1')).toHaveTextContent('1/2');
    });

    // Check parent task complete -> optimistic cascade updates badge to 2/2
    await user.click(screen.getByTestId('task-checkbox-dt-1'));
    await waitFor(() => {
      expect(patchDayTaskMock).toHaveBeenCalled();
      expect(screen.getByTestId('task-subtask-badge-dt-1')).toHaveTextContent('2/2');
    });

    // Open Edit modal and move task to a future date (2099-12-31 is always in the future)
    await user.click(screen.getByTestId('task-edit-dt-1'));
    const dateInput = screen.getByTestId('edit-task-move-date');
    fireEvent.change(dateInput, { target: { value: '2099-12-31' } });
    await user.click(screen.getByRole('button', { name: 'Save & Move' }));

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          target_date: '2099-12-31',
          source_date: mockDate,
          day_task_id: 'dt-1',
        })
      );
    });
  });
});
