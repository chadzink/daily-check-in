import React, { useState } from 'react';
import { Layers, Search, CheckSquare, Square } from 'lucide-react';
import { MasterTask } from '../../types/domain';

interface Step3BacklogPullProps {
  backlogTasks: MasterTask[];
  selectedTaskIds: string[];
  onToggleSelect: (taskId: string) => void;
}

export const Step3BacklogPull: React.FC<Step3BacklogPullProps> = ({
  backlogTasks,
  selectedTaskIds,
  onToggleSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = (backlogTasks || []).filter((task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Layers className="h-4 w-4 text-violet-400" />
            <span>Pull from Global Backlog</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Select items from your persistent backlog to commit to Today.
          </p>
        </div>

        {/* Search Filter */}
        <div className="relative min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter backlog..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400">
          <Layers className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-300">
            {searchQuery ? 'No backlog items match your search.' : 'Global backlog is empty.'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            You can always add new tasks directly on the board throughout the day.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {filteredTasks.map((task) => {
            const isSelected = selectedTaskIds.includes(task.id);

            return (
              <div
                key={task.id}
                onClick={() => onToggleSelect(task.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-violet-950/40 border-violet-500/50 shadow-sm shadow-violet-500/10'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="text-violet-400 flex-shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-violet-400" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-slate-200 truncate">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-violet-400/90 font-medium px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 flex-shrink-0">
                  #{task.backlog_order || '-'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
