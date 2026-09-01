import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ExecutionRow } from './ExecutionRow';
import { TaskCard, TaskCardData } from './TaskCard';
import { DayTaskWithDetails } from '../../types/domain';

interface YesterdayRowProps {
  tasks: DayTaskWithDetails[];
}

export const YesterdayRow: React.FC<YesterdayRowProps> = ({ tasks }) => {
  const cardDataList: TaskCardData[] = tasks.map((t) => ({
    id: t.day_task_id,
    taskId: t.task_id,
    title: t.title,
    description: t.description,
    status: 'YESTERDAY',
    isCompleted: true,
    completedAt: t.completed_at,
    priorityOrder: t.priority_order,
  }));

  return (
    <ExecutionRow
      droppableId="YESTERDAY"
      title="Yesterday"
      count={tasks.length}
      icon={<CheckCircle2 className="h-4 w-4" />}
      accentColor="emerald"
      emptyMessage="No accomplishments recorded from previous active day."
      isDropDisabled={true}
    >
      {cardDataList.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
          isDragDisabled={true}
        />
      ))}
    </ExecutionRow>
  );
};
