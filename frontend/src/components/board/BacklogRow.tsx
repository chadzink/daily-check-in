import React from 'react';
import { Layers } from 'lucide-react';
import { ExecutionRow } from './ExecutionRow';
import { TaskCard, TaskCardData } from './TaskCard';
import { QuickAddInput } from './QuickAddInput';
import { MasterTask, Subtask } from '../../types/domain';

interface BacklogRowProps {
  tasks: MasterTask[];
  disablePull?: boolean;
  onPull: (taskId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMoveToIndex?: (fromIndex: number, toIndex: number) => void;
  onEdit: (task: TaskCardData) => void;
  onDelete: (task: TaskCardData) => void;
  onUpdateSubtasks?: (taskId: string, subtasks: Subtask[]) => void;
  onAddTask: (title: string) => void;
  onOpenDetailedAdd?: () => void;
  isAddingTask?: boolean;
  quickAddRef?: React.RefObject<HTMLInputElement>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const BacklogRow: React.FC<BacklogRowProps> = ({
  tasks,
  disablePull = false,
  onPull,
  onMoveUp,
  onMoveDown,
  onMoveToIndex,
  onEdit,
  onDelete,
  onUpdateSubtasks,
  onAddTask,
  onOpenDetailedAdd,
  isAddingTask = false,
  quickAddRef,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const cardDataList: TaskCardData[] = tasks.map((t, idx) => ({
    id: t.id,
    taskId: t.id,
    title: t.title,
    description: t.description,
    status: 'BACKLOG',
    isCompleted: t.is_completed,
    completedAt: t.completed_at,
    priorityOrder: idx + 1,
    subtasks: t.subtasks || [],
  }));

  return (
    <ExecutionRow
      droppableId="BACKLOG"
      title="Backlog"
      count={tasks.length}
      icon={<Layers className="h-4 w-4" />}
      accentColor="violet"
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      emptyMessage="Global backlog is empty. Add tasks to pull into daily execution."
      headerAction={
        <QuickAddInput
          placeholder="Add task to Backlog... (Enter)"
          shortcutKey="B"
          onAdd={onAddTask}
          onOpenDetailedAdd={onOpenDetailedAdd}
          isLoading={isAddingTask}
          inputRef={quickAddRef}
        />
      }
    >
      {cardDataList.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
          totalCount={cardDataList.length}
          disablePull={disablePull}
          onPull={onPull}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onMoveToIndex={onMoveToIndex}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateSubtasks={onUpdateSubtasks}
        />
      ))}
    </ExecutionRow>
  );
};
