import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ExecutionRow } from './ExecutionRow';
import { TaskCard, TaskCardData } from './TaskCard';
import { DayTaskWithDetails } from '../../types/domain';

interface YesterdayRowProps {
  tasks: DayTaskWithDetails[];
  title?: string;
  subtitle?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const YesterdayRow: React.FC<YesterdayRowProps> = ({
  tasks,
  title = 'Yesterday',
  subtitle,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const cardDataList: TaskCardData[] = tasks.map((t) => ({
    id: t.day_task_id,
    taskId: t.task_id,
    title: t.title,
    description: t.description,
    status: 'YESTERDAY',
    isCompleted: true,
    completedAt: t.completed_at,
    priorityOrder: t.priority_order,
    subtasks: t.subtasks || [],
  }));

  return (
    <ExecutionRow
      droppableId="YESTERDAY"
      title={title}
      subtitle={subtitle}
      count={tasks.length}
      icon={<CheckCircle2 className="h-4 w-4" />}
      accentColor="emerald"
      emptyMessage="No accomplishments recorded from previous active day."
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
    >
      {cardDataList.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
          totalCount={cardDataList.length}
          isReadOnly={true}
        />
      ))}
    </ExecutionRow>
  );
};
