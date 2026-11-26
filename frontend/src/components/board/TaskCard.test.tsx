import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskCard, TaskCardData } from './TaskCard';

describe('TaskCard Component', () => {
  it('renders Today task with priority rank and triggers completion toggle', async () => {
    const onToggleMock = vi.fn();
    const task: TaskCardData = {
      id: 'dt-1',
      taskId: 't-1',
      title: 'Fix issue #123',
      description: 'Reproduce bug in local environment',
      status: 'TODAY',
      isCompleted: false,
      priorityOrder: 2,
    };

    const user = userEvent.setup();
    render(
      <TaskCard
        task={task}
        index={0}
        totalCount={1}
        onToggleComplete={onToggleMock}
      />
    );

    expect(screen.getByText('Fix issue #123')).toBeInTheDocument();
    expect(screen.getByText('Reproduce bug in local environment')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();

    const checkbox = screen.getByTestId('task-checkbox-dt-1');
    await user.click(checkbox);
    expect(onToggleMock).toHaveBeenCalledWith('dt-1', true);
  });

  it('renders up/down arrows with boundary disabled states and triggers reorder callbacks', async () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const task: TaskCardData = {
      id: 'dt-mid',
      taskId: 't-mid',
      title: 'Middle Task',
      status: 'TODAY',
      isCompleted: false,
      priorityOrder: 2,
    };

    const user = userEvent.setup();
    const { rerender } = render(
      <TaskCard
        task={task}
        index={0}
        totalCount={2}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    );

    expect(screen.getByTestId('task-move-up-dt-mid')).toBeDisabled();
    expect(screen.getByTestId('task-move-down-dt-mid')).not.toBeDisabled();
    await user.click(screen.getByTestId('task-move-down-dt-mid'));
    expect(onMoveDown).toHaveBeenCalledWith(0);

    rerender(
      <TaskCard
        task={task}
        index={1}
        totalCount={2}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    );
    expect(screen.getByTestId('task-move-up-dt-mid')).not.toBeDisabled();
    expect(screen.getByTestId('task-move-down-dt-mid')).toBeDisabled();
    await user.click(screen.getByTestId('task-move-up-dt-mid'));
    expect(onMoveUp).toHaveBeenCalledWith(1);
  });

  it('renders Mark as Blocked, Edit, and Delete buttons for Today tasks', async () => {
    const onBlock = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const task: TaskCardData = {
      id: 'dt-today',
      taskId: 't-today',
      title: 'Actionable Task',
      status: 'TODAY',
      isCompleted: false,
    };

    const user = userEvent.setup();
    render(
      <TaskCard
        task={task}
        index={0}
        totalCount={1}
        onBlock={onBlock}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByTestId('task-block-dt-today'));
    expect(onBlock).toHaveBeenCalledWith('dt-today', 'Actionable Task');

    await user.click(screen.getByTestId('task-edit-dt-today'));
    expect(onEdit).toHaveBeenCalledWith(task);

    await user.click(screen.getByTestId('task-delete-dt-today'));
    expect(onDelete).toHaveBeenCalledWith(task);
  });

  it('renders Blocked task with blocker reason chip and allows unblocking', async () => {
    const onUnblockMock = vi.fn();
    const task: TaskCardData = {
      id: 'dt-blocked-1',
      taskId: 't-blocked-1',
      title: 'Blocked Database Migration',
      status: 'BLOCKED',
      isCompleted: false,
      blockerReason: 'Waiting for staging DB credential rotation',
    };

    const user = userEvent.setup();
    render(
      <TaskCard
        task={task}
        index={0}
        totalCount={1}
        onUnblock={onUnblockMock}
      />
    );

    expect(screen.getByText('Blocked Database Migration')).toBeInTheDocument();
    expect(screen.getByText('Waiting for staging DB credential rotation')).toBeInTheDocument();

    const unblockBtn = screen.getByTitle('Unblock task (Move back to Today)');
    await user.click(unblockBtn);
    expect(onUnblockMock).toHaveBeenCalledWith('dt-blocked-1');
  });

  it('renders Backlog task with 1-click Pull button', async () => {
    const onPullMock = vi.fn();
    const task: TaskCardData = {
      id: 't-backlog-10',
      taskId: 't-backlog-10',
      title: 'Design Dark Mode tokens',
      status: 'BACKLOG',
      priorityOrder: 1,
    };

    const user = userEvent.setup();
    render(
      <TaskCard
        task={task}
        index={0}
        totalCount={1}
        onPull={onPullMock}
      />
    );

    expect(screen.getByText('Design Dark Mode tokens')).toBeInTheDocument();
    const pullBtn = screen.getByTitle("Pull into Today's execution list");
    await user.click(pullBtn);
    expect(onPullMock).toHaveBeenCalledWith('t-backlog-10');
  });

  it('renders completed task with strikethrough styling and timestamp', () => {
    const task: TaskCardData = {
      id: 'dt-done-1',
      taskId: 't-done-1',
      title: 'Completed Task',
      status: 'TODAY',
      isCompleted: true,
      completedAt: '2026-08-31T15:30:00Z',
    };

    render(
      <TaskCard
        task={task}
        index={0}
        totalCount={1}
      />
    );

    const titleEl = screen.getByText('Completed Task');
    expect(titleEl).toHaveClass('line-through');
    expect(screen.getByText(/Completed at/i)).toBeInTheDocument();
  });

  it('allows clicking #N rank badge to jump to a specific index', async () => {
    const onMoveToIndex = vi.fn();
    const task: TaskCardData = {
      id: 'dt-jump',
      taskId: 't-jump',
      title: 'Jumpable Task',
      status: 'TODAY',
      isCompleted: false,
      priorityOrder: 1,
    };

    const user = userEvent.setup();
    render(
      <TaskCard
        task={task}
        index={0}
        totalCount={4}
        onMoveToIndex={onMoveToIndex}
      />
    );

    await user.click(screen.getByTestId('task-rank-dt-jump'));
    const input = screen.getByTestId('task-rank-input-dt-jump');
    await user.clear(input);
    await user.type(input, '3{Enter}');

    expect(onMoveToIndex).toHaveBeenCalledWith(0, 2);
  });

  it('disables Backlog Pull button with tooltip when disablePull is true', async () => {
    const onPullMock = vi.fn();
    const task: TaskCardData = {
      id: 't-backlog-past',
      taskId: 't-backlog-past',
      title: 'Backlog Item on Past Day',
      status: 'BACKLOG',
      priorityOrder: 1,
    };

    const user = userEvent.setup();
    render(
      <TaskCard
        task={task}
        index={0}
        totalCount={1}
        disablePull={true}
        onPull={onPullMock}
      />
    );

    const pullBtn = screen.getByTestId('task-pull-t-backlog-past');
    expect(pullBtn).toBeDisabled();
    expect(pullBtn).toHaveAttribute('aria-disabled', 'true');
    expect(pullBtn).toHaveAttribute('title', 'Cannot pull tasks into a past date');
    await user.click(pullBtn);
    expect(onPullMock).not.toHaveBeenCalled();
  });

  it('renders expanded inline sub-tasks with progress badge and supports add, toggle, edit, and delete', async () => {
    const onUpdateSubtasks = vi.fn();
    const onToggleComplete = vi.fn();
    const task: TaskCardData = {
      id: 'dt-sub-1',
      taskId: 't-sub-1',
      title: 'Ship auth middleware',
      status: 'TODAY',
      isCompleted: false,
      subtasks: [
        { id: 's-1', title: 'Verify JWT claims', is_completed: true, order: 1 },
        { id: 's-2', title: 'Add rate limit test', is_completed: false, order: 2 },
      ],
    };

    const user = userEvent.setup();
    const { rerender } = render(
      <TaskCard
        task={task}
        index={0}
        totalCount={1}
        onToggleComplete={onToggleComplete}
        onUpdateSubtasks={onUpdateSubtasks}
      />
    );

    // Progress badge shows 1/2
    const badge = screen.getByTestId('task-subtask-badge-dt-sub-1');
    expect(badge).toHaveTextContent('1/2');
    expect(screen.getByTestId('subtask-title-s-1')).toHaveTextContent('Verify JWT claims');
    expect(screen.getByTestId('subtask-title-s-2')).toHaveTextContent('Add rate limit test');

    // Toggle second sub-task independently (must not call parent onToggleComplete)
    await user.click(screen.getByTestId('subtask-checkbox-s-2'));
    expect(onToggleComplete).not.toHaveBeenCalled();
    expect(onUpdateSubtasks).toHaveBeenCalledWith('t-sub-1', [
      { id: 's-1', title: 'Verify JWT claims', is_completed: true, order: 1 },
      { id: 's-2', title: 'Add rate limit test', is_completed: true, order: 2 },
    ]);

    // Rerender with all completed -> emerald badge 2/2
    rerender(
      <TaskCard
        task={{
          ...task,
          subtasks: [
            { id: 's-1', title: 'Verify JWT claims', is_completed: true, order: 1 },
            { id: 's-2', title: 'Add rate limit test', is_completed: true, order: 2 },
          ],
        }}
        index={0}
        totalCount={1}
        onToggleComplete={onToggleComplete}
        onUpdateSubtasks={onUpdateSubtasks}
      />
    );
    expect(screen.getByTestId('task-subtask-badge-dt-sub-1')).toHaveTextContent('2/2');
    expect(screen.getByTestId('task-subtask-badge-dt-sub-1').className).toContain('emerald');

    // Inline click-to-edit title
    await user.click(screen.getByTestId('subtask-title-s-1'));
    const editInput = screen.getByTestId('subtask-edit-input-s-1');
    await user.clear(editInput);
    await user.type(editInput, 'Verify JWT scopes{Enter}');
    expect(onUpdateSubtasks).toHaveBeenLastCalledWith('t-sub-1', [
      { id: 's-1', title: 'Verify JWT scopes', is_completed: true, order: 1 },
      { id: 's-2', title: 'Add rate limit test', is_completed: true, order: 2 },
    ]);

    // Delete a sub-task
    await user.click(screen.getByTestId('subtask-delete-s-1'));
    expect(onUpdateSubtasks).toHaveBeenLastCalledWith('t-sub-1', [
      { id: 's-2', title: 'Add rate limit test', is_completed: true, order: 1 },
    ]);

    // Inline add sub-task stays open after Enter and closes on Escape
    await user.click(screen.getByTestId('task-add-subtask-trigger-dt-sub-1'));
    const addInput = screen.getByTestId('task-add-subtask-input-dt-sub-1');
    await user.type(addInput, 'Update docs{Enter}');
    expect(onUpdateSubtasks).toHaveBeenLastCalledWith(
      't-sub-1',
      expect.arrayContaining([
        expect.objectContaining({ title: 'Update docs', is_completed: false, order: 3 }),
      ])
    );
    expect(screen.getByTestId('task-add-subtask-input-dt-sub-1')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('task-add-subtask-input-dt-sub-1')).not.toBeInTheDocument();
  });

  it('renders sub-tasks in read-only mode on Yesterday/historical cards without add/edit/delete controls', () => {
    const task: TaskCardData = {
      id: 'dt-y-sub',
      taskId: 't-y-sub',
      title: 'Yesterday Task With Subtasks',
      status: 'YESTERDAY',
      isCompleted: true,
      subtasks: [
        { id: 's-y1', title: 'Completed sub', is_completed: true, order: 1 },
      ],
    };

    render(
      <TaskCard
        task={task}
        index={0}
        totalCount={1}
        isReadOnly={true}
      />
    );

    expect(screen.getByTestId('task-subtask-badge-dt-y-sub')).toHaveTextContent('1/1');
    expect(screen.getByTestId('subtask-checkbox-s-y1')).toBeDisabled();
    expect(screen.getByTestId('subtask-title-s-y1').tagName).toBe('SPAN');
    expect(screen.queryByTestId('subtask-delete-s-y1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-add-subtask-trigger-dt-y-sub')).not.toBeInTheDocument();
  });
});
