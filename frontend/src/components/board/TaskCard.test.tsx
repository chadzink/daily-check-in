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
        isDragDisabled={true}
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
        isDragDisabled={true}
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
        isDragDisabled={true}
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
        isDragDisabled={true}
      />
    );

    const titleEl = screen.getByText('Completed Task');
    expect(titleEl).toHaveClass('line-through');
    expect(screen.getByText(/Completed at/i)).toBeInTheDocument();
  });
});
