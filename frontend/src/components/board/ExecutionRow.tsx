import React from 'react';
import { Droppable } from '@hello-pangea/dnd';

interface ExecutionRowProps {
  droppableId: string;
  title: string;
  count: number;
  icon: React.ReactNode;
  accentColor: 'emerald' | 'sky' | 'amber' | 'violet';
  emptyMessage: string;
  isDropDisabled?: boolean;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}

const colorMap = {
  emerald: {
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dropHighlight: 'bg-emerald-500/5 ring-emerald-500/30',
  },
  sky: {
    border: 'border-sky-500/20',
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    iconBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    dropHighlight: 'bg-sky-500/5 ring-sky-500/30',
  },
  amber: {
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dropHighlight: 'bg-amber-500/5 ring-amber-500/30',
  },
  violet: {
    border: 'border-violet-500/20',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    iconBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    dropHighlight: 'bg-violet-500/5 ring-violet-500/30',
  },
};

export const ExecutionRow: React.FC<ExecutionRowProps> = ({
  droppableId,
  title,
  count,
  icon,
  accentColor,
  emptyMessage,
  isDropDisabled = false,
  children,
  headerAction,
}) => {
  const styles = colorMap[accentColor];

  return (
    <div
      data-testid={`execution-row-${droppableId.toLowerCase()}`}
      className="flex flex-col rounded-2xl bg-slate-900/50 border border-slate-800/80 p-4 sm:p-5 shadow-xl backdrop-blur-sm transition-all"
    >
      {/* Row Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center space-x-2.5">
          <div
            className={`h-7 w-7 rounded-lg border flex items-center justify-center ${styles.iconBg}`}
          >
            {icon}
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
          <span
            className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full border ${styles.badge}`}
          >
            {count}
          </span>
        </div>
        {headerAction && (
          <div className="w-full sm:w-80 md:w-96">{headerAction}</div>
        )}
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={droppableId} isDropDisabled={isDropDisabled}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-[76px] rounded-xl p-1.5 sm:p-2 transition-all duration-150 flex flex-col gap-2 ${
              snapshot.isDraggingOver ? `ring-2 ${styles.dropHighlight}` : ''
            }`}
          >
            {count === 0 && !snapshot.isDraggingOver ? (
              <div className="min-h-[64px] flex items-center justify-center text-center px-4 py-3 border border-dashed border-slate-800 rounded-xl">
                <p className="text-xs text-slate-500 font-medium">{emptyMessage}</p>
              </div>
            ) : (
              children
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
