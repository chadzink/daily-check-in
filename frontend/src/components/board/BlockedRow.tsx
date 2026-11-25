import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ExecutionRow } from './ExecutionRow';
import { TaskCard, TaskCardData } from './TaskCard';
import { QuickAddInput } from './QuickAddInput';
import { DayTaskWithDetails } from '../../types/domain';

interface BlockedRowProps {
  tasks: DayTaskWithDetails[];
  onToggleComplete: (dayTaskId: string, isCompleted: boolean) => void;
  onDemote: (dayTaskId: string) => void;
  onUnblock: (dayTaskId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMoveToIndex?: (fromIndex: number, toIndex: number) => void;
  onEdit: (task: TaskCardData) => void;
  onDelete: (task: TaskCardData) => void;
  onAddTask?: (title: string) => void;
  onOpenDetailedAdd?: () => void;
  isAddingTask?: boolean;
  isReadOnly?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const BlockedRow: React.FC<BlockedRowProps> = ({
  tasks,
  onToggleComplete,
  onDemote,
  onUnblock,
  onMoveUp,
  onMoveDown,
  onMoveToIndex,
  onEdit,
  onDelete,
  onAddTask,
  onOpenDetailedAdd,
  isAddingTask = false,
  isReadOnly = false,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const cardDataList: TaskCardData[] = tasks.map((t, idx) => ({
    id: t.day_task_id,
    taskId: t.task_id,
    title: t.title,
    description: t.description,
    status: 'BLOCKED',
    isCompleted: t.is_completed,
    completedAt: t.completed_at,
    priorityOrder: idx + 1,
    blockerReason: t.blocker_reason,
  }));

  return (
    <ExecutionRow
      droppableId="BLOCKED"
      title="Blocked"
      count={tasks.length}
      icon={<AlertTriangle className="h-4 w-4" />}
      accentColor="amber"
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      emptyMessage={
        isReadOnly
          ? 'No blocked tasks were recorded for this day.'
          : 'No blocked tasks. Use the block icon on a Today task to track impediments.'
      }
      headerAction={
        !isReadOnly && onAddTask ? (
          <QuickAddInput
            placeholder="Add blocked task... (Enter)"
            onAdd={onAddTask}
            onOpenDetailedAdd={onOpenDetailedAdd}
            isLoading={isAddingTask}
          />
        ) : undefined
      }
    >
      {cardDataList.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
          totalCount={cardDataList.length}
          isReadOnly={isReadOnly}
          onToggleComplete={onToggleComplete}
          onDemote={onDemote}
          onUnblock={onUnblock}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onMoveToIndex={onMoveToIndex}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ExecutionRow>
  );
};
