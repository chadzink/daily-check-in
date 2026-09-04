import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ExecutionRow } from './ExecutionRow';
import { TaskCard, TaskCardData } from './TaskCard';
import { DayTaskWithDetails } from '../../types/domain';

interface BlockedRowProps {
  tasks: DayTaskWithDetails[];
  onToggleComplete: (dayTaskId: string, isCompleted: boolean) => void;
  onDemote: (dayTaskId: string) => void;
  onUnblock: (dayTaskId: string) => void;
  isReadOnly?: boolean;
}

export const BlockedRow: React.FC<BlockedRowProps> = ({
  tasks,
  onToggleComplete,
  onDemote,
  onUnblock,
  isReadOnly = false,
}) => {
  const cardDataList: TaskCardData[] = tasks.map((t) => ({
    id: t.day_task_id,
    taskId: t.task_id,
    title: t.title,
    description: t.description,
    status: 'BLOCKED',
    isCompleted: t.is_completed,
    completedAt: t.completed_at,
    priorityOrder: t.priority_order,
    blockerReason: t.blocker_reason,
  }));

  return (
    <ExecutionRow
      droppableId="BLOCKED"
      title="Blocked"
      count={tasks.length}
      icon={<AlertTriangle className="h-4 w-4" />}
      accentColor="amber"
      isDropDisabled={isReadOnly}
      emptyMessage={
        isReadOnly
          ? 'No blocked tasks were recorded for this day.'
          : 'No blocked tasks. Drag items here to track impediments.'
      }
    >
      {cardDataList.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
          isReadOnly={isReadOnly}
          onToggleComplete={onToggleComplete}
          onDemote={onDemote}
          onUnblock={onUnblock}
        />
      ))}
    </ExecutionRow>
  );
};
