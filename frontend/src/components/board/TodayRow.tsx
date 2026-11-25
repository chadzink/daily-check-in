import React from 'react';
import { Target } from 'lucide-react';
import { ExecutionRow } from './ExecutionRow';
import { TaskCard, TaskCardData } from './TaskCard';
import { QuickAddInput } from './QuickAddInput';
import { DayTaskWithDetails } from '../../types/domain';

interface TodayRowProps {
  tasks: DayTaskWithDetails[];
  title?: string;
  onToggleComplete: (dayTaskId: string, isCompleted: boolean) => void;
  onDemote: (dayTaskId: string) => void;
  onBlock: (dayTaskId: string, title: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMoveToIndex?: (fromIndex: number, toIndex: number) => void;
  onEdit: (task: TaskCardData) => void;
  onDelete: (task: TaskCardData) => void;
  onAddTask: (title: string) => void;
  onOpenDetailedAdd?: () => void;
  isAddingTask?: boolean;
  quickAddRef?: React.RefObject<HTMLInputElement>;
  isReadOnly?: boolean;
}

export const TodayRow: React.FC<TodayRowProps> = ({
  tasks,
  title = 'Today',
  onToggleComplete,
  onDemote,
  onBlock,
  onMoveUp,
  onMoveDown,
  onMoveToIndex,
  onEdit,
  onDelete,
  onAddTask,
  onOpenDetailedAdd,
  isAddingTask = false,
  quickAddRef,
  isReadOnly = false,
}) => {
  const cardDataList: TaskCardData[] = tasks.map((t, idx) => ({
    id: t.day_task_id,
    taskId: t.task_id,
    title: t.title,
    description: t.description,
    status: 'TODAY',
    isCompleted: t.is_completed,
    completedAt: t.completed_at,
    priorityOrder: idx + 1,
    blockerReason: t.blocker_reason,
  }));

  return (
    <ExecutionRow
      droppableId="TODAY"
      title={title}
      count={tasks.length}
      icon={<Target className="h-4 w-4" />}
      accentColor="sky"
      emptyMessage={
        isReadOnly
          ? 'No tasks were recorded for this day.'
          : 'No tasks scheduled for today. Pull from Backlog or quick-add above.'
      }
      headerAction={
        !isReadOnly ? (
          <QuickAddInput
            placeholder="Add task to Today... (Enter)"
            shortcutKey="N"
            onAdd={onAddTask}
            onOpenDetailedAdd={onOpenDetailedAdd}
            isLoading={isAddingTask}
            inputRef={quickAddRef}
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
          onBlock={onBlock}
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
