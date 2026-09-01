import React from 'react';
import { Layers } from 'lucide-react';
import { ExecutionRow } from './ExecutionRow';
import { TaskCard, TaskCardData } from './TaskCard';
import { QuickAddInput } from './QuickAddInput';
import { MasterTask } from '../../types/domain';

interface BacklogRowProps {
  tasks: MasterTask[];
  onPull: (taskId: string) => void;
  onAddTask: (title: string) => void;
  isAddingTask?: boolean;
  quickAddRef?: React.RefObject<HTMLInputElement>;
}

export const BacklogRow: React.FC<BacklogRowProps> = ({
  tasks,
  onPull,
  onAddTask,
  isAddingTask = false,
  quickAddRef,
}) => {
  const cardDataList: TaskCardData[] = tasks.map((t) => ({
    id: t.id,
    taskId: t.id,
    title: t.title,
    description: t.description,
    status: 'BACKLOG',
    isCompleted: t.is_completed,
    completedAt: t.completed_at,
    priorityOrder: t.backlog_order,
  }));

  return (
    <ExecutionRow
      droppableId="BACKLOG"
      title="Backlog"
      count={tasks.length}
      icon={<Layers className="h-4 w-4" />}
      accentColor="violet"
      emptyMessage="Global backlog is empty. Add tasks to pull into daily execution."
      headerAction={
        <QuickAddInput
          placeholder="Add task to Backlog... (Enter)"
          shortcutKey="B"
          onAdd={onAddTask}
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
          onPull={onPull}
        />
      ))}
    </ExecutionRow>
  );
};
